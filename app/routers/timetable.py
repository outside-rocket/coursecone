"""Timetable upload + weekly grid endpoints (weak-entity schema)."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import parser as portal                                    # noqa: E402
from fastapi import APIRouter, Depends, HTTPException      # noqa: E402
from pydantic import BaseModel                             # noqa: E402
from sqlalchemy.orm import Session                         # noqa: E402

from ..database import get_db                              # noqa: E402
from ..deps import current_student                         # noqa: E402
from ..grid_engine import build_weekly_grid                # noqa: E402
from ..models import (ClassOffering, ClassSlotBreakdown,   # noqa: E402
                      Course, Enrollment, Faculty, Person,
                      SlotDefinition, Student)
from ..slot_data import SLOT_DEFINITIONS, slots_overlap    # noqa: E402

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


def _upsert_all(db: Session, rec: dict, semester_id: str) -> ClassOffering:
    if not rec["CourseCode"] or not rec["ClassID"]:
        raise HTTPException(422, f"Record missing code/class id: {rec['CourseCode']}")

    course = db.get(Course, rec["CourseCode"])
    if not course:
        course = Course(course_code=rec["CourseCode"],
                        course_title=rec["CourseTitle"] or rec["CourseCode"],
                        course_type=rec["CourseType"], l=rec["L"], t=rec["T"],
                        p=rec["P"], j=rec["J"], credits=rec["Credits"],
                        course_category=rec["CourseCategory"],
                        course_option=rec["CourseOption"])
        db.add(course)

    faculty = None
    if rec["FacultyName"]:
        faculty = (db.query(Faculty).join(Person)
                   .filter(Person.full_name == rec["FacultyName"]).first())
        if not faculty:
            person = Person(full_name=rec["FacultyName"],
                            email=f"faculty{db.query(Faculty).count()+1}@vitstudent.ac.in",
                            password_hash="!")
            db.add(person)
            db.flush()
            faculty = Faculty(person_id=person.person_id, school=rec["School"],
                              emp_no=100000 + db.query(Faculty).count() + 1)
            db.add(faculty)
            db.flush()

    offering = db.get(ClassOffering, (rec["CourseCode"], rec["ClassID"]))
    if not offering:
        offering = ClassOffering(course_code=rec["CourseCode"], class_id=rec["ClassID"],
                                 faculty_id=faculty.person_id if faculty else _any_faculty(db),
                                 venue=rec["Venue"], semester_id=semester_id)
        db.add(offering)
        db.flush()
        for tok in rec["SlotTokens"]:                       # 1NF atomic breakdown rows
            if tok in SLOT_DEFINITIONS:
                db.add(ClassSlotBreakdown(course_code=offering.course_code,
                                          class_id=offering.class_id, slot_token=tok))
    return offering


def _any_faculty(db: Session) -> int:
    f = db.query(Faculty).first()
    if not f:
        p = Person(full_name="TBD FACULTY", email="tbd.faculty@vitstudent.ac.in",
                   password_hash="!")
        db.add(p)
        db.flush()
        f = Faculty(person_id=p.person_id, emp_no=100000)
        db.add(f)
        db.flush()
    return f.person_id


@router.post("/upload")
def upload(body: UploadIn, student: Student = Depends(current_student),
           db: Session = Depends(get_db)):
    records = portal.parse_portal_text(body.raw_text)
    _ensure_slot_definitions(db)

    existing_tokens = [t for (t,) in
                       db.query(ClassSlotBreakdown.slot_token)
                       .join(Enrollment, (Enrollment.course_code == ClassSlotBreakdown.course_code)
                             & (Enrollment.class_id == ClassSlotBreakdown.class_id))
                       .filter(Enrollment.student_id == student.student_id,
                               Enrollment.status == "CONFIRMED").all()]

    saved = []
    for rec in records:
        if rec["Status"] and "registered" not in rec["Status"].lower():
            continue
        if rec["SlotTokens"] and slots_overlap(rec["SlotTokens"], existing_tokens):
            raise HTTPException(409, f"Slot conflict: {rec['CourseCode']} "
                                     f"({'+'.join(rec['SlotTokens'])}) overlaps an enrollment")
        offering = _upsert_all(db, rec, body.semester_id)
        key = (student.student_id, offering.course_code, offering.class_id)
        if not db.get(Enrollment, key):
            db.add(Enrollment(student_id=key[0], course_code=key[1],
                              class_id=key[2], status="CONFIRMED"))
        existing_tokens += rec["SlotTokens"]
        saved.append(rec["CourseCode"])

    db.commit()
    return {"parsed": len(records), "saved_courses": saved}


@router.get("/grid")
def grid(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = (db.query(ClassOffering, ClassSlotBreakdown.slot_token)
            .join(Enrollment, (Enrollment.course_code == ClassOffering.course_code)
                  & (Enrollment.class_id == ClassOffering.class_id))
            .join(ClassSlotBreakdown, (ClassSlotBreakdown.course_code == ClassOffering.course_code)
                  & (ClassSlotBreakdown.class_id == ClassOffering.class_id))
            .filter(Enrollment.student_id == student.student_id,
                    Enrollment.status == "CONFIRMED").all())

    classes: dict[str, dict] = {}
    for co, token in rows:
        c = classes.setdefault(co.class_id, {
            "CourseCode": co.course_code,
            "CourseTitle": co.course.course_title if co.course else co.course_code,
            "RoomNo": co.venue,
            "FacultyName": co.faculty.person.full_name if co.faculty else None,
            "SlotTokens": []})
        c["SlotTokens"].append(token)

    return build_weekly_grid(list(classes.values()))
