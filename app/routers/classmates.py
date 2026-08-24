"""Peer discovery via v_public_peers-equivalent query (privacy-preserving)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student, optional_student
from ..models import (ClassOffering, ClassSlotBreakdown, Enrollment,
                      Student, UserFollow)

router = APIRouter(prefix="/api/classmates", tags=["classmates"])


def _rel_status(db: Session, me: int, other: int) -> str:
    """NONE | REQUESTED (my request pending) | FOLLOWING | FOLLOWS_YOU | MUTUAL."""
    mine = db.query(UserFollow).filter_by(follower_id=me, following_id=other).first()
    theirs = db.query(UserFollow).filter_by(follower_id=other, following_id=me).first()
    m = bool(mine and theirs and mine.status == "ACCEPTED" and theirs.status == "ACCEPTED")
    if m:
        return "MUTUAL"
    if mine and mine.status == "ACCEPTED":
        return "FOLLOWING"
    if mine and mine.status == "PENDING":
        return "REQUESTED"
    if theirs and theirs.status == "ACCEPTED":
        return "FOLLOWS_YOU"
    return "NONE"


def _shared_courses(db: Session, student_id: int) -> list[dict]:
    rows = (db.query(Enrollment, ClassOffering)
            .join(ClassOffering, (ClassOffering.course_code == Enrollment.course_code)
                  & (ClassOffering.class_id == Enrollment.class_id))
            .filter(Enrollment.student_id == student_id,
                    Enrollment.status == "CONFIRMED").all())
    out = []
    for enr, co in rows:
        tokens = sorted(t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                        .filter_by(course_code=enr.course_code, class_id=enr.class_id).all())
        out.append({"class_id": enr.class_id, "course": enr.course_code,
                    "slot": "+".join(tokens), "venue": co.venue})
    return out


@router.get("/all")
def all_classmates(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Auto-discover every peer sharing at least one class with me,
    plus my own course list for course-based filtering."""
    my_course_list = _shared_courses(db, s.student_id)
    my_classes = {(c["course"], c["class_id"]) for c in my_course_list}
    if not my_classes:
        return {"count": 0, "classmates": []}

    rows = (db.query(Enrollment, Student)
            .join(Student, Student.student_id == Enrollment.student_id)
            .filter(Enrollment.status == "CONFIRMED",
                    Enrollment.student_id != s.student_id).all())

    seen: dict[int, dict] = {}
    for enr, stu in rows:
        if (enr.course_code, enr.class_id) not in my_classes:
            continue
        entry = seen.setdefault(stu.student_id, {
            "student_id": str(stu.student_id), "name": stu.name,
            "rel": _rel_status(db, s.student_id, stu.student_id), "classes": []})
        co = db.get(ClassOffering, (enr.course_code, enr.class_id))
        tokens = sorted(t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                        .filter_by(course_code=enr.course_code, class_id=enr.class_id).all())
        if not any(c["class_id"] == enr.class_id for c in entry["classes"]):
            entry["classes"].append({"class_id": enr.class_id, "course": enr.course_code,
                                     "slot": "+".join(tokens), "venue": co.venue})

    results = sorted(seen.values(), key=lambda x: (x["rel"] != "MUTUAL", x["name"]))
    return {"count": len(results), "classmates": results,
            "my_courses": [{"course": c["course"], "slot": c["slot"]}
                           for c in my_course_list]}


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

    following: dict[int, UserFollow] = {}
    if s:
        following = {f.following_id: f for f in
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
        if s:
            r["rel"] = _rel_status(db, s.student_id, int(r["student_id"]))
    return {"course_code": course_code.upper(), "count": len(results),
            "classmates": results}
