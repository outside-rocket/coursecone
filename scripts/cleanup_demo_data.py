"""One-off cleanup: remove demo/test accounts and their data.

Keeps any account that does NOT match the known test-email/name patterns.
Run:  python scripts/cleanup_demo_data.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import re
from app.database import SessionLocal, engine, Base
from app.models import (Base as _B, ChatMessage, ClassOffering, ClassSlotBreakdown,
                        Enrollment, Faculty, Person, Student, SwapInterest,
                        SwapListing, UserFollow)

TEST_EMAIL = re.compile(r"^(t\d{4}|[pqwcdefm]\d+)@vitstudent\.ac\.in$", re.I)
TEST_NAMES = ("Peer ", "ZPeer ", "AA ", "Cmp ", "Mkt ", "Matrix ", "Spec Test",
              "Test User", "Matrix Test")

db = SessionLocal()
victims = [p for p in db.query(Person).all()
           if (p.email and TEST_EMAIL.match(p.email))
           or (p.full_name and p.full_name.startswith(TEST_NAMES))]

n = 0
for p in victims:
    stu = db.query(Student).filter_by(student_id=p.person_id).first()
    if stu:
        db.query(SwapInterest).filter_by(student_id=stu.student_id).delete(synchronize_session=False)
        db.query(SwapListing).filter_by(student_id=stu.student_id).delete(synchronize_session=False)
        db.query(ChatMessage).filter((ChatMessage.sender_id == stu.student_id) |
                                     (ChatMessage.receiver_id == stu.student_id)) \
            .delete(synchronize_session=False)
        db.query(UserFollow).filter((UserFollow.follower_id == stu.student_id) |
                                    (UserFollow.following_id == stu.student_id)) \
            .delete(synchronize_session=False)
        db.query(Enrollment).filter_by(student_id=stu.student_id) \
            .delete(synchronize_session=False)
        db.delete(stu)
    fac = db.query(Faculty).filter_by(person_id=p.person_id).first()
    if fac:
        db.delete(fac)
    db.delete(p)
    n += 1

# bogus faculty rows created by the old parser bug (school captured as name)
placeholder = None
for f in db.query(Faculty).all():
    if f.person and f.person.full_name in ("SCOPE", "SENSE", "SAS", "VITBS", "ACAD"):
        if placeholder is None:
            p = Person(full_name="TBD FACULTY",
                       email="tbd.faculty@vitstudent.ac.in", password_hash="!")
            db.add(p)
            db.flush()
            placeholder = Faculty(person_id=p.person_id, emp_no=999999)
            db.add(placeholder)
            db.flush()
        for co in db.query(ClassOffering).filter_by(faculty_id=f.person_id):
            co.faculty_id = placeholder.person_id
        db.delete(f)

# orphaned offerings with no enrollments left
for co in db.query(ClassOffering).all():
    if not db.query(Enrollment).filter_by(course_code=co.course_code,
                                          class_id=co.class_id).count():
        db.query(ClassSlotBreakdown).filter_by(course_code=co.course_code,
                                               class_id=co.class_id) \
            .delete(synchronize_session=False)
        db.query(SwapListing).filter_by(course_code=co.course_code) \
            .delete(synchronize_session=False)
        db.delete(co)

db.commit()
print(f"removed {n} demo accounts; DB clean.")
print("remaining students:", db.query(Student).count())
