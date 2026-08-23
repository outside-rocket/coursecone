"""Peer discovery: find students enrolled in the same class/slot."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student, optional_student
from ..models import (ClassOffering, ClassSlotMapping, Course,
                      Student, StudentEnrollment, UserFollow)

router = APIRouter(prefix="/api/classmates", tags=["classmates"])


@router.get("/find")
def find(course_code: str, slot_token: str | None = None,
         s: Student = Depends(optional_student), db: Session = Depends(get_db)):
    """Find Classmates in [CourseCode] [SlotCode]. Contact details masked."""
    q = (db.query(StudentEnrollment, Student)
         .join(ClassSlotMapping,
               ClassSlotMapping.class_id == StudentEnrollment.class_id)
         .join(ClassOffering, ClassOffering.class_id == StudentEnrollment.class_id)
         .join(Student, Student.student_id == StudentEnrollment.student_id)
         .filter(ClassOffering.course_code == course_code.upper(),
                 StudentEnrollment.status == "CONFIRMED"))
    if slot_token:
        q = q.filter(ClassSlotMapping.slot_token == slot_token.upper())

    following: set[str] = set()
    if s:
        following = {str(f.following_id) for f in
                     db.query(UserFollow).filter_by(follower_id=s.student_id).all()}

    seen: dict[str, dict] = {}
    for enr, stu in q.all():
        entry = seen.setdefault(str(stu.student_id), {
            "student_id": str(stu.student_id), "name": stu.name,  # roll/email masked
            "classes": []})
        tokens = [t for (t,) in db.query(ClassSlotMapping.slot_token)
                  .filter_by(class_id=enr.class_id).all()]
        co = db.get(ClassOffering, enr.class_id)
        entry["classes"].append({
            "class_id": enr.class_id, "slot": "+".join(tokens), "venue": co.venue})

    results = list(seen.values())
    for r in results:
        r["is_following"] = r["student_id"] in following
    return {"course_code": course_code.upper(), "count": len(results),
            "classmates": results}
