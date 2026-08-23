"""Peer discovery via v_public_peers-equivalent query (privacy-preserving)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import optional_student
from ..models import (ClassOffering, ClassSlotBreakdown, Enrollment,
                      Student, UserFollow)

router = APIRouter(prefix="/api/classmates", tags=["classmates"])


@router.get("/find")
def find(course_code: str, slot_token: str | None = None,
         s: Student = Depends(optional_student), db: Session = Depends(get_db)):
    """Find classmates in [CourseCode] [SlotCode]. Roll no / email masked."""
    q = (db.query(Enrollment, Student)
         .join(ClassOffering, (ClassOffering.course_code == Enrollment.course_code)
               & (ClassOffering.class_id == Enrollment.class_id))
         .join(ClassSlotBreakdown, (ClassSlotBreakdown.course_code == Enrollment.course_code)
               & (ClassSlotBreakdown.class_id == Enrollment.class_id))
         .join(Student, Student.student_id == Enrollment.student_id)
         .filter(Enrollment.course_code == course_code.upper(),
                 Enrollment.status == "CONFIRMED"))
    if slot_token:
        q = q.filter(ClassSlotBreakdown.slot_token == slot_token.upper())

    following: set[int] = set()
    if s:
        following = {f.following_id for f in
                     db.query(UserFollow).filter_by(follower_id=s.student_id).all()}

    seen: dict[int, dict] = {}
    for enr, stu in q.all():
        entry = seen.setdefault(stu.student_id, {
            "student_id": str(stu.student_id), "name": stu.name, "classes": []})
        tokens = sorted(t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                        .filter_by(course_code=enr.course_code, class_id=enr.class_id).all())
        co = db.get(ClassOffering, (enr.course_code, enr.class_id))
        key = f"{enr.course_code}:{enr.class_id}"
        if not any(c["class_id"] == enr.class_id for c in entry["classes"]):
            entry["classes"].append({
                "class_id": enr.class_id, "course": enr.course_code,
                "slot": "+".join(tokens), "venue": co.venue})

    results = list(seen.values())
    for r in results:
        r["is_following"] = r["student_id"] in {str(x) for x in following}
    return {"course_code": course_code.upper(), "count": len(results),
            "classmates": results}
