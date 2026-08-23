"""Timetable upload + weekly grid endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from parser.portal_parser import parse_portal_text          # noqa: E402

from ..database import get_db                               # noqa: E402
from ..deps import current_student                          # noqa: E402
from ..grid_engine import build_weekly_grid                 # noqa: E402
from ..models import (ClassOffering, ClassSlotMapping, Course,   # noqa: E402
                      Faculty, SlotDefinition, Student, StudentEnrollment)
from ..slot_data import SLOT_DEFINITIONS, slots_overlap      # noqa: E402

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


class UploadIn(BaseModel):
    raw_text: str
    semester_id: str = "F2025-26"


def _ensure_slot_definitions(db: Session):
    if db.query(SlotDefinition).count() == 0:
        for sd in SLOT_DEFINITIONS.values():
            db.add(SlotDefinition(
                slot_token=sd["slot_token"], slot_type=sd["slot_type"],
                day_of_week=sd["day_of_week"],
                start_time=sd["start_time"].strftime("%H:%M"),
                end_time=sd["end_time"].strftime("%H:%M")))
        db.flush()


def _upsert_class(db: Session, rec: dict, semester_id: str) -> ClassOffering:
    if not rec["CourseCode"] or not rec["ClassID"]:
        raise HTTPException(422, f"Unparseable row: {rec}")
    if not db.get(Course, rec["CourseCode"]):
        db.add(Course(course_code=rec["CourseCode"], course_title=rec["CourseTitle"],
                      credits=rec["Credits"], course_category=rec["CourseCategory"]))
    if rec["FacultyEmpID"] and not db.get(Faculty, rec["FacultyEmpID"]):
        db.add(Faculty(faculty_id=rec["FacultyEmpID"],
                       faculty_name=rec["FacultyName"] or "Unknown"))
    cls = db.get(ClassOffering, rec["ClassID"])
    if not cls:
        cls = ClassOffering(class_id=rec["ClassID"], course_code=rec["CourseCode"],
                            faculty_id=rec["FacultyEmpID"], venue=rec["RoomNo"],
                            semester_id=semester_id)
        db.add(cls)
        db.flush()
        for tok in rec["SlotTokens"]:
            if tok in SLOT_DEFINITIONS:
                db.add(ClassSlotMapping(class_id=cls.class_id, slot_token=tok))
    return cls


@router.post("/upload")
def upload(body: UploadIn, student: Student = Depends(current_student),
           db: Session = Depends(get_db)):
    records = parse_portal_text(body.raw_text)
    _ensure_slot_definitions(db)

    # overlap validation (application-level; mirrors the PG trigger)
    existing_tokens = [
        m.slot_token for m in db.query(ClassSlotMapping)
        .join(StudentEnrollment, StudentEnrollment.class_id == ClassSlotMapping.class_id)
        .filter(StudentEnrollment.student_id == student.student_id,
                StudentEnrollment.status == "CONFIRMED").all()
    ]

    saved = []
    for rec in records:
        if rec["Status"].lower() not in ("registered", "confirmed"):
            continue
        if rec["SlotTokens"] and slots_overlap(rec["SlotTokens"], existing_tokens):
            raise HTTPException(409,
                f"Slot conflict: {rec['CourseCode']} ({'+'.join(rec['SlotTokens'])}) "
                f"overlaps an existing enrollment")
        cls = _upsert_class(db, rec, body.semester_id)
        if not db.get(StudentEnrollment, (student.student_id, cls.class_id)):
            db.add(StudentEnrollment(student_id=student.student_id, class_id=cls.class_id))
        existing_tokens += rec["SlotTokens"]
        saved.append(rec["CourseCode"])

    db.commit()
    return {"parsed": len(records), "saved_courses": saved}


@router.get("/grid")
def grid(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = (db.query(ClassOffering, ClassSlotMapping.slot_token)
            .join(StudentEnrollment,
                  StudentEnrollment.class_id == ClassOffering.class_id)
            .join(ClassSlotMapping,
                  ClassSlotMapping.class_id == ClassOffering.class_id)
            .filter(StudentEnrollment.student_id == student.student_id,
                    StudentEnrollment.status == "CONFIRMED").all())

    classes: dict[str, dict] = {}
    for co, token in rows:
        c = classes.setdefault(co.class_id, {
            "CourseCode": co.course_code,
            "CourseTitle": co.course.course_title if co.course else co.course_code,
            "RoomNo": co.venue,
            "FacultyName": co.faculty.faculty_name if co.faculty else None,
            "SlotTokens": []})
        c["SlotTokens"].append(token)

    return build_weekly_grid(list(classes.values()))
