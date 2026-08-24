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

import hashlib
import re
import uuid
from sqlalchemy import func

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


class UploadIn(BaseModel):
    raw_text: str
    semester_id: str = "F2025-26"


def _ensure_slot_definitions(db: Session):
    if db.query(SlotDefinition).count() == 0:
        for placements in SLOT_DEFINITIONS.values():
            sd = placements[0]                     # canonical (first) placement
            db.add(SlotDefinition(
                slot_token=sd["slot_token"], slot_type=sd["slot_type"],
                day_of_week=sd["day_of_week"],
                start_time=sd["start_time"].strftime("%H:%M"),
                end_time=sd["end_time"].strftime("%H:%M")))
        db.flush()


def _upsert_all(db: Session, rec: dict, semester_id: str) -> ClassOffering:
    if not rec.get("CourseCode"):
        raise HTTPException(422, "Course code is required in FFCS paste")

    # Generate synthetic ClassID if missing from table paste
    if not rec.get("ClassID"):
        s_hash = hashlib.md5(f"{rec['CourseCode']}-{rec.get('SlotString')}-{rec.get('Venue')}".encode()).hexdigest()[:11].upper()
        rec["ClassID"] = f"CH{s_hash}"

    course = db.get(Course, rec["CourseCode"])
    if not course:
        course = Course(course_code=rec["CourseCode"],
                        course_title=rec["CourseTitle"] or rec["CourseCode"],
                        course_type=rec.get("CourseType") or "THEORY",
                        l=rec.get("L") or 0, t=rec.get("T") or 0,
                        p=rec.get("P") or 0, j=rec.get("J") or 0,
                        credits=rec.get("Credits") or 0.0,
                        course_category=rec.get("CourseCategory"),
                        course_option=rec.get("CourseOption"))
        db.add(course)
        db.flush()

    faculty = None
    if rec.get("FacultyName") and rec["FacultyName"].strip():
        fname = rec["FacultyName"].strip()
        faculty = (db.query(Faculty).join(Person)
                   .filter(Person.full_name == fname).first())
        if not faculty:
            # Generate unique collision-free email and emp_no
            f_slug = re.sub(r"[^a-z0-9]", "", fname.lower())[:10] or "fac"
            unique_email = f"faculty.{f_slug}.{uuid.uuid4().hex[:6]}@vitstudent.ac.in"
            person = Person(full_name=fname,
                            email=unique_email,
                            password_hash="!")
            db.add(person)
            db.flush()

            max_emp = db.query(func.max(Faculty.emp_no)).scalar() or 100000
            emp_no = max(max_emp + 1, 100001)
            faculty = Faculty(person_id=person.person_id, school=rec.get("School") or "SCOPE",
                              emp_no=emp_no)
            db.add(faculty)
            db.flush()

    offering = db.get(ClassOffering, (rec["CourseCode"], rec["ClassID"]))
    if not offering:
        offering = ClassOffering(course_code=rec["CourseCode"], class_id=rec["ClassID"],
                                 faculty_id=faculty.person_id if faculty else _any_faculty(db),
                                 slot_string=rec.get("SlotString"), venue=rec.get("Venue"),
                                 semester_id=semester_id)
        db.add(offering)
        db.flush()
    else:
        # keep compound slot string, venue and faculty fresh on re-upload
        offering.slot_string = rec.get("SlotString")
        if rec.get("Venue"):
            offering.venue = rec["Venue"]
        if faculty:
            offering.faculty_id = faculty.person_id

    # ensure the 1NF atomic breakdown rows exist (idempotent re-upload)
    have = {t for (t,) in db.query(ClassSlotBreakdown.slot_token)
            .filter_by(course_code=offering.course_code, class_id=offering.class_id).all()}
    for tok in (rec.get("SlotTokens") or []):
        if tok in have:
            continue
        if tok in SLOT_DEFINITIONS:
            db.add(ClassSlotBreakdown(course_code=offering.course_code,
                                      class_id=offering.class_id, slot_token=tok))
    return offering


def _any_faculty(db: Session) -> int:
    f = db.query(Faculty).first()
    if not f:
        p = db.query(Person).filter_by(email="tbd.faculty@vitstudent.ac.in").first()
        if not p:
            p = Person(full_name="TBD FACULTY", email=f"tbd.faculty.{uuid.uuid4().hex[:6]}@vitstudent.ac.in",
                       password_hash="!")
            db.add(p)
            db.flush()
        f = Faculty(person_id=p.person_id, emp_no=999999)
        db.add(f)
        db.flush()
    return f.person_id


@router.post("/upload")
def upload(body: UploadIn, student: Student = Depends(current_student),
           db: Session = Depends(get_db)):
    try:
        records = portal.parse_portal_text(body.raw_text)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Could not parse FFCS registration: {str(e)}")

    _ensure_slot_definitions(db)

    existing_tokens = [t for (t,) in
                       db.query(ClassSlotBreakdown.slot_token)
                       .join(Enrollment, (Enrollment.course_code == ClassSlotBreakdown.course_code)
                             & (Enrollment.class_id == ClassSlotBreakdown.class_id))
                       .filter(Enrollment.student_id == student.student_id,
                               Enrollment.status == "CONFIRMED").all()]

    saved = []
    warnings = []
    try:
        for rec in records:
            if rec.get("Status") and "registered" not in rec["Status"].lower():
                continue
            if rec.get("SlotTokens") and slots_overlap(rec["SlotTokens"], existing_tokens):
                warnings.append(f"{rec['CourseCode']} ({'+'.join(rec['SlotTokens'])}) "
                                f"overlaps another session")
            offering = _upsert_all(db, rec, body.semester_id)
            key = (student.student_id, offering.course_code, offering.class_id)
            enr = db.get(Enrollment, key)
            if not enr:
                db.add(Enrollment(student_id=key[0], course_code=key[1],
                                  class_id=key[2], status="CONFIRMED",
                                  slot_tokens=rec.get("SlotString")))
            else:
                enr.slot_tokens = rec.get("SlotString")
            existing_tokens += (rec.get("SlotTokens") or [])
            saved.append(rec["CourseCode"])

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as err:
        db.rollback()
        raise HTTPException(500, f"Failed to save registration: {str(err)}")

    return {"parsed": len(records), "saved_courses": saved, "warnings": warnings}


@router.get("/grid")
def grid(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = (db.query(Enrollment, ClassOffering)
            .join(ClassOffering, (ClassOffering.course_code == Enrollment.course_code)
                  & (ClassOffering.class_id == Enrollment.class_id))
            .filter(Enrollment.student_id == student.student_id,
                    Enrollment.status == "CONFIRMED").all())

    classes: list[dict] = []
    for enr, co in rows:
        toks = [t.strip().upper() for t in (enr.slot_tokens or "").split("+")
                if t.strip() and t.strip().upper() != "NIL"]
        if not toks:                                # legacy fallback
            toks = [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                    .filter_by(course_code=enr.course_code, class_id=enr.class_id).all()]
        classes.append({
            "CourseCode": co.course_code,
            "CourseTitle": co.course.course_title if co.course else co.course_code,
            "RoomNo": co.venue,
            "FacultyName": co.faculty.person.full_name if co.faculty else None,
            "SlotTokens": toks})

    return build_weekly_grid(classes)
