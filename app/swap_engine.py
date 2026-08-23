"""ACID slot-swap engine — strict Two-Phase Locking.

Growing phase : FOR UPDATE row locks on both listings and both students'
                enrollments (prevents double-claiming races).
Verification  : mutual compatibility + post-swap timetable conflict checks
                for BOTH students before any write.
Shrinking phase: exchange class mappings, mark COMPLETED, log transaction.
Any failure raises inside the caller's transaction => full rollback.
"""
from __future__ import annotations

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from .models import ClassSlotBreakdown, Enrollment, SwapListing, SwapTransaction
from .slot_data import get_slot, slots_overlap


def _class_tokens(db: Session, course_code: str, class_id: str) -> list[str]:
    return [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
            .filter_by(course_code=course_code, class_id=class_id).all()]


def _student_tokens(db: Session, student_id: int) -> list[str]:
    rows = (db.query(ClassSlotBreakdown.slot_token)
            .join(Enrollment, (Enrollment.course_code == ClassSlotBreakdown.course_code)
                  & (Enrollment.class_id == ClassSlotBreakdown.class_id))
            .filter(Enrollment.student_id == student_id,
                    Enrollment.status == "CONFIRMED").all())
    return [t for (t,) in rows]


def _conflict_after_swap(db: Session, student_id: int,
                         drop_class: tuple[str, str],
                         gain_class: tuple[str, str]) -> bool:
    """Would gaining `gain_class` clash with the schedule minus `drop_class`?"""
    kept = [t for t in _student_tokens(db, student_id)
            if t not in _class_tokens(db, *drop_class)]
    return slots_overlap(_class_tokens(db, *gain_class), kept)


def execute_swap(db: Session, sender_listing_id: int, receiver_listing_id: int,
                 actor_student_id: int) -> dict:
    ls = db.get(SwapListing, sender_listing_id)
    lr = db.get(SwapListing, receiver_listing_id)
    if not ls or not lr:
        raise LookupError("listing not found")
    if ls.student_id != actor_student_id:
        raise PermissionError("you can only execute your own listing")
    if ls.status != "OPEN" or lr.status != "OPEN":
        raise RuntimeError("race detected: a listing is no longer OPEN")

    # ---- GROWING PHASE: acquire all locks up-front ----
    db.query(SwapListing).filter(
        SwapListing.listing_id.in_([sender_listing_id, receiver_listing_id])
    ).with_for_update().all()
    db.query(Enrollment).filter(
        Enrollment.student_id.in_([ls.student_id, lr.student_id])
    ).with_for_update().all()

    # ---- VERIFICATION ----
    if ls.desired_course_code != lr.offered_course_code:
        raise ValueError("listings are not mutually compatible")

    mine_drop = (ls.offered_course_code, ls.offered_class_id)
    peer_drop = (lr.offered_course_code, lr.offered_class_id)
    if _conflict_after_swap(db, ls.student_id, mine_drop, peer_drop):
        raise ValueError("swap rejected: slot conflict with your remaining classes")
    if _conflict_after_swap(db, lr.student_id, peer_drop, mine_drop):
        raise ValueError("swap rejected: slot conflict for the peer's schedule")

    # ---- SHRINKING PHASE: atomic exchange ----
    for e in db.query(Enrollment).filter(
            Enrollment.student_id.in_([ls.student_id, lr.student_id]),
            Enrollment.course_code.in_([ls.offered_course_code, lr.offered_course_code]),
            Enrollment.class_id.in_([ls.offered_class_id, lr.offered_class_id])).all():
        db.delete(e)
    db.add_all([
        Enrollment(student_id=ls.student_id, course_code=peer_drop[0],
                   class_id=peer_drop[1], status="CONFIRMED"),
        Enrollment(student_id=lr.student_id, course_code=mine_drop[0],
                   class_id=mine_drop[1], status="CONFIRMED"),
    ])
    ls.status = lr.status = "COMPLETED"
    db.add(SwapTransaction(sender_id=ls.student_id, receiver_id=lr.student_id,
                           sender_listing_id=ls.listing_id,
                           receiver_listing_id=lr.listing_id,
                           status="ACCEPTED", executed_at=sa_func.now()))
    db.commit()
    return {"status": "COMPLETED",
            "exchanged": {"you_now_have": f"{peer_drop[0]}/{peer_drop[1]}",
                          "peer_now_has": f"{mine_drop[0]}/{mine_drop[1]}"},
            "contact_unlocked": True}
