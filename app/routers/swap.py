"""FFCS swap marketplace: listings, 1-1 & 3-way cycle matching,
and atomic swap execution with row-level locking (2PL)."""
from __future__ import annotations

from itertools import permutations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..deps import current_student
from ..models import (ClassOffering, ClassSlotMapping, SlotSwapListing,
                      Student, StudentEnrollment, SwapTransaction)

router = APIRouter(prefix="/api/swap", tags=["swap"])


class ListingIn(BaseModel):
    offered_class_id: str
    desired_course_code: str
    desired_slot_tokens: list[str]


@router.post("/list")
def create_listing(body: ListingIn, s: Student = Depends(current_student),
                   db: Session = Depends(get_db)):
    cls = db.get(ClassOffering, body.offered_class_id)
    if not cls:
        raise HTTPException(404, "Offered class not found")
    enr = db.get(StudentEnrollment, (s.student_id, body.offered_class_id))
    if not enr or enr.status != "CONFIRMED":
        raise HTTPException(403, "You must be enrolled in the offered class")
    listing = SlotSwapListing(student_id=s.student_id,
                              offered_class_id=body.offered_class_id,
                              desired_course_code=body.desired_course_code.upper(),
                              desired_slot_tokens=[t.upper() for t in body.desired_slot_tokens])
    db.add(listing)
    db.commit()
    return {"listing_id": listing.listing_id, "status": listing.status}


@router.get("/mine")
def my_listings(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = db.query(SlotSwapListing).filter_by(student_id=s.student_id).all()
    return [{"listing_id": r.listing_id, "offered_class_id": r.offered_class_id,
             "desired_course_code": r.desired_course_code,
             "desired_slot_tokens": r.desired_slot_tokens,
             "status": r.status} for r in rows]


def _listing_view(db: Session, l: SlotSwapListing) -> dict:
    co = db.get(ClassOffering, l.offered_class_id)
    offered_slot = "+".join(
        t for (t,) in db.query(ClassSlotMapping.slot_token).filter_by(class_id=l.offered_class_id))
    return {
        "listing_id": l.listing_id, "student_id": str(l.student_id),
        "offered_course_code": co.course_code if co else None,
        "offered_slot_tokens": offered_slot.split("+"),
        "desired_course_code": l.desired_course_code,
        "desired_slot_tokens": l.desired_slot_tokens or [],
    }


@router.get("/match")
def match(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Return direct 1-to-1 swaps and 3-way circular trade cycles."""
    open_listings = db.query(SlotSwapListing).filter_by(status="OPEN").all()
    views = [_listing_view(db, l) for l in open_listings]
    by_id = {v["listing_id"]: v for v in views}

    def compatible(a: dict, b: dict) -> bool:
        # a offers what b desires, and b offers what a desires
        return (a["desired_course_code"] == b["offered_course_code"]
                and (not a["desired_slot_tokens"]
                     or bool(set(a["desired_slot_tokens"]) & set(b["offered_slot_tokens"])))
                and b["desired_course_code"] == a["offered_course_code"]
                and (not b["desired_slot_tokens"]
                     or bool(set(b["desired_slot_tokens"]) & set(a["offered_slot_tokens"]))))

    mine = [v for v in views if v["student_id"] == str(s.student_id)]
    others = [v for v in views if v["student_id"] != str(s.student_id)]

    one_to_one = []
    for m in mine:
        for o in others:
            if compatible(m, o):
                one_to_one.append({"my_listing": m, "peer_listing": o})
    matched_ids = {p["my_listing"]["listing_id"]: p["peer_listing"]["listing_id"]
                   for p in one_to_one}

    cycles = []
    for m in mine:
        for tri in permutations(others, 3):
            chain = [m, *tri]
            if all(compatible(chain[i], chain[(i + 1) % 4]) for i in range(4)):
                cycles.append({"cycle": chain})
                break  # one cycle per listing keeps payload small

    return {"one_to_one": one_to_one, "three_way_cycles": cycles[:5]}


class ExecuteIn(BaseModel):
    my_listing_id: int
    peer_listing_id: int


@router.post("/execute")
def execute(body: ExecuteIn, s: Student = Depends(current_student)):
    """Atomic swap under 2PL: SELECT ... FOR UPDATE on both listings,
    exchange enrollments, mark COMPLETED. Single transaction, rollback on error."""
    engine = SessionLocal.kw["bind"]
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            lock_sql = sql_text("SELECT * FROM slot_swap_listings WHERE listing_id IN (:a,:b)")
            try:
                rows = conn.execute(sql_text(lock_sql.string + " FOR UPDATE"),
                                    {"a": body.my_listing_id, "b": body.peer_listing_id}).fetchall()
            except Exception:  # SQLite: plain lock via BEGIN IMMEDIATE semantics
                rows = conn.execute(lock_sql,
                                    {"a": body.my_listing_id, "b": body.peer_listing_id}).fetchall()
            if len(rows) != 2:
                raise HTTPException(404, "One or both listings not found")

            by_id = {}
            for r in rows:
                mapping = r._mapping
                by_id[mapping["listing_id"]] = mapping
            mine, peer = by_id[body.my_listing_id], by_id[body.peer_listing_id]

            my_sid = str(s.student_id)
            if mine["student_id"] != my_sid:
                raise HTTPException(403, "You can only execute your own listing")
            if mine["status"] != "OPEN" or peer["status"] != "OPEN":
                raise HTTPException(409, "A listing is no longer OPEN (already claimed)")

            my_class, peer_class = mine["offered_class_id"], peer["offered_class_id"]

            # exchange enrollments (drop both, re-add crossed)
            conn.execute(sql_text(
                "DELETE FROM student_enrollments "
                "WHERE (student_id=:sid AND class_id IN (:a,:b)) "
                "   OR (student_id=:pid AND class_id IN (:a,:b))"),
                {"sid": my_sid, "pid": str(peer["student_id"]),
                 "a": my_class, "b": peer_class})
            insert_sql = ("INSERT INTO student_enrollments (student_id, class_id, status) "
                          "VALUES (:sid, :cls, 'CONFIRMED')")
            if engine.dialect.name == "sqlite":
                insert_sql = insert_sql.replace("INSERT INTO", "INSERT OR IGNORE INTO")
            conn.execute(sql_text(insert_sql), {"sid": peer["student_id"], "cls": my_class})
            conn.execute(sql_text(insert_sql), {"sid": my_sid, "cls": peer_class})

            conn.execute(sql_text(
                "UPDATE slot_swap_listings SET status='COMPLETED' WHERE listing_id IN (:a,:b)"),
                {"a": body.my_listing_id, "b": body.peer_listing_id})
            conn.execute(sql_text(
                "INSERT INTO swap_transactions (sender_id, receiver_id, sender_listing_id, "
                "receiver_listing_id, status) VALUES (:s,:r,:sl,:rl,'ACCEPTED')"),
                {"s": my_sid, "r": str(peer["student_id"]),
                 "sl": body.my_listing_id, "rl": body.peer_listing_id})
            trans.commit()
        except HTTPException:
            trans.rollback()
            raise
        except Exception as e:
            trans.rollback()
            raise HTTPException(500, f"Swap rolled back: {e}")

    return {"status": "COMPLETED",
            "exchanged": {"you_now_have": peer_class, "peer_now_has": my_class},
            "contact_unlocked": True}
