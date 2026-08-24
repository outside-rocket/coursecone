"""Swap marketplace — matching + ACID execution via app/swap_engine.py."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student
from ..models import (ClassOffering, ClassSlotBreakdown, Enrollment,
                      SwapListing, SwapInterest, Student, UserFollow)
from ..slot_data import SLOT_DEFINITIONS
from ..swap_engine import execute_swap

router = APIRouter(prefix="/api/swap", tags=["swap"])


class ListingIn(BaseModel):
    offered_class_id: str
    desired_course_code: str
    desired_slot_tokens: list[str] = []
    offered_course_code: str | None = None   # optional; derived if omitted


@router.post("/list")
def create_listing(body: ListingIn, s: Student = Depends(current_student),
                   db: Session = Depends(get_db)):
    # resolve course_code from the weak-entity composite key
    q = db.query(ClassOffering).filter(ClassOffering.class_id == body.offered_class_id)
    if body.offered_course_code:
        q = q.filter(ClassOffering.course_code == body.offered_course_code.upper())
    offerings = q.all()
    if not offerings:
        raise HTTPException(404, "Offered class not found")
    if len(offerings) > 1 and not body.offered_course_code:
        raise HTTPException(422, "Ambiguous class id — pass offered_course_code")
    co = offerings[0]

    enr = db.get(Enrollment, (s.student_id, co.course_code, co.class_id))
    if not enr or enr.status != "CONFIRMED":
        raise HTTPException(403, "You must be enrolled in the offered class")

    listing = SwapListing(student_id=s.student_id,
                          offered_course_code=co.course_code,
                          offered_class_id=co.class_id,
                          desired_course_code=body.desired_course_code.upper(),
                          desired_slot_tokens=[t.upper() for t in body.desired_slot_tokens])
    db.add(listing)
    db.commit()
    return {"listing_id": listing.listing_id, "status": listing.status,
            "offered": f"{co.course_code}/{co.class_id}"}


@router.get("/mine")
def my_listings(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = db.query(SwapListing).filter_by(student_id=s.student_id).all()
    out = []
    for r in rows:
        n = db.query(SwapInterest).filter_by(listing_id=r.listing_id).count()
        out.append({"listing_id": r.listing_id,
                    "offered_course_code": r.offered_course_code,
                    "offered_class_id": r.offered_class_id,
                    "desired_course_code": r.desired_course_code,
                    "desired_slot_tokens": r.desired_slot_tokens,
                    "status": r.status, "interest_count": n})
    return out


@router.delete("/list/{listing_id}")
def delete_listing(listing_id: int, s: Student = Depends(current_student),
                   db: Session = Depends(get_db)):
    l = db.get(SwapListing, listing_id)
    if not l or l.student_id != s.student_id:
        raise HTTPException(404, "Listing not found")
    db.query(SwapInterest).filter_by(listing_id=listing_id).delete()
    db.delete(l)
    db.commit()
    return {"deleted": True}


@router.post("/list/{listing_id}/interest")
def express_interest(listing_id: int, s: Student = Depends(current_student),
                     db: Session = Depends(get_db)):
    """Toggle 'I want this slot' on someone's open listing."""
    l = db.get(SwapListing, listing_id)
    if not l or l.status != "OPEN":
        raise HTTPException(404, "Listing not open")
    if l.student_id == s.student_id:
        raise HTTPException(400, "That is your own listing")
    existing = (db.query(SwapInterest)
                .filter_by(listing_id=listing_id, student_id=s.student_id).first())
    if existing:
        db.delete(existing)
        db.commit()
        return {"interested": False}
    db.add(SwapInterest(listing_id=listing_id, student_id=s.student_id))
    db.commit()
    return {"interested": True}


@router.get("/list/{listing_id}/interests")
def listing_interests(listing_id: int, s: Student = Depends(current_student),
                      db: Session = Depends(get_db)):
    """Owner-only: everyone who requested this listing."""
    l = db.get(SwapListing, listing_id)
    if not l or l.student_id != s.student_id:
        raise HTTPException(404, "Listing not found")
    rows = (db.query(Student, SwapInterest.created_at)
            .join(SwapInterest, SwapInterest.student_id == Student.student_id)
            .filter(SwapInterest.listing_id == listing_id).all())
    return {"listing_id": listing_id,
            "requests": [{"student_id": str(stu.student_id), "name": stu.name,
                          "at": str(at)} for stu, at in rows]}


@router.get("/my-classes")
def my_classes(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """My enrolled classes for the sell-dropdown (no class-id typing needed)."""
    rows = (db.query(Enrollment, ClassOffering)
            .join(ClassOffering, (ClassOffering.course_code == Enrollment.course_code)
                  & (ClassOffering.class_id == Enrollment.class_id))
            .filter(Enrollment.student_id == s.student_id,
                    Enrollment.status == "CONFIRMED").all())
    out = []
    for enr, co in rows:
        toks = [t.strip().upper() for t in (enr.slot_tokens or "").split("+")
                if t.strip() and t.strip().upper() != "NIL"]
        if not toks:
            toks = [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                    .filter_by(course_code=enr.course_code, class_id=enr.class_id).all()]
        out.append({"class_id": enr.class_id, "course": enr.course_code,
                    "title": co.course.course_title if co.course else enr.course_code,
                    "venue": co.venue, "slot_tokens": toks,
                    "faculty": co.faculty.person.full_name if co.faculty else None})
    return {"classes": out}


@router.get("/market")
def market(q: str | None = None, teacher: str | None = None,
           course: str | None = None, slot_type: str | None = None,
           s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Searchable open listings: filter by teacher, subject or LAB/THEORY."""
    def slot_kind(tok: str) -> str:
        p = SLOT_DEFINITIONS.get(tok)
        return p[0]["slot_type"] if p else "?"

    results = []
    for l in db.query(SwapListing).filter_by(status="OPEN").all():
        if l.student_id == s.student_id:
            continue
        co = db.get(ClassOffering, (l.offered_course_code, l.offered_class_id))
        tokens = [t.strip().upper() for t in (co.slot_string or "").split("+")
                  if t.strip()] if co else []
        if not tokens:
            tokens = [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                      .filter_by(course_code=l.offered_course_code,
                                 class_id=l.offered_class_id).all()]
        kinds = {slot_kind(t) for t in tokens}
        teacher_name = co.faculty.person.full_name if co and co.faculty else ""
        course_title = co.course.course_title if co and co.course else l.offered_course_code
        peer = db.get(Student, l.student_id)
        item = {"listing_id": l.listing_id,
                "student_id": str(l.student_id), "peer_name": peer.name if peer else "?",
                "course": l.offered_course_code, "course_title": course_title,
                "faculty": teacher_name, "venue": co.venue if co else None,
                "slot_tokens": tokens, "kinds": sorted(kinds),
                "desired_course_code": l.desired_course_code,
                "desired_slot_tokens": l.desired_slot_tokens or []}
        # filters
        if q:
            ql = q.lower()
            hay = f"{teacher_name} {l.offered_course_code} {course_title} {' '.join(tokens)}".lower()
            if ql not in hay:
                continue
        if teacher and teacher.lower() not in teacher_name.lower():
            continue
        if course and course.upper() not in l.offered_course_code.upper() \
                and course.lower() not in course_title.lower():
            continue
        if slot_type and slot_type.upper() not in kinds:
            continue
        results.append(item)
    return {"count": len(results), "listings": results}


def _listing_view(db: Session, l: SwapListing) -> dict:
    tokens = [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
              .filter_by(course_code=l.offered_course_code,
                         class_id=l.offered_class_id).all()]
    return {"listing_id": l.listing_id, "student_id": str(l.student_id),
            "offered_course_code": l.offered_course_code,
            "offered_slot_tokens": tokens,
            "desired_course_code": l.desired_course_code,
            "desired_slot_tokens": l.desired_slot_tokens or []}


@router.get("/match")
def match(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Direct 1-to-1 swaps + 3-way circular trade cycles."""
    from itertools import permutations

    views = [_listing_view(db, l)
             for l in db.query(SwapListing).filter_by(status="OPEN").all()]

    def compatible(a: dict, b: dict) -> bool:
        return (a["desired_course_code"] == b["offered_course_code"]
                and (not a["desired_slot_tokens"]
                     or bool(set(a["desired_slot_tokens"]) & set(b["offered_slot_tokens"])))
                and b["desired_course_code"] == a["offered_course_code"]
                and (not b["desired_slot_tokens"]
                     or bool(set(b["desired_slot_tokens"]) & set(a["offered_slot_tokens"]))))

    mine = [v for v in views if v["student_id"] == str(s.student_id)]
    others = [v for v in views if v["student_id"] != str(s.student_id)]

    one_to_one = [{"my_listing": m, "peer_listing": o}
                  for m in mine for o in others if compatible(m, o)]
    matched_peer_ids = {p["peer_listing"]["listing_id"] for p in one_to_one}

    cycles = []
    for m in mine:
        for tri in permutations(others, 3):
            chain = [m, *tri]
            if all(compatible(chain[i], chain[(i + 1) % 4]) for i in range(4)):
                cycles.append({"cycle": chain})
                break

    return {"one_to_one": one_to_one, "three_way_cycles": cycles[:5]}


class ExecuteIn(BaseModel):
    my_listing_id: int
    peer_listing_id: int


@router.post("/execute")
def execute(body: ExecuteIn, s: Student = Depends(current_student),
            db: Session = Depends(get_db)):
    """Atomic swap under 2PL — see app/swap_engine.py. Full rollback on failure."""
    try:
        return execute_swap(db, body.my_listing_id, body.peer_listing_id,
                            s.student_id)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except LookupError as e:
        raise HTTPException(404, str(e))
    except (ValueError, RuntimeError) as e:
        db.rollback()
        raise HTTPException(409, str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"swap rolled back: {e}")
