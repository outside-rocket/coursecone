"""Instagram-style follow REQUESTS + mutual detection + direct chat.

Flow: POST /follow creates a PENDING edge -> target ACCEPTs via
POST /requests/accept -> only then is the follow realised and chat unlocked.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student
from ..models import (ChatMessage, ClassOffering, ClassSlotBreakdown,
                      Enrollment, Student, UserFollow)
from ..slot_data import DAYS, LAB_TIME_SLOTS, MASTER_SCHEDULE_MATRIX, THEORY_TIME_SLOTS

router = APIRouter(prefix="/api/social", tags=["social"])


def _edge(db: Session, follower: int, following: int) -> UserFollow | None:
    return db.query(UserFollow).filter_by(follower_id=follower,
                                          following_id=following).first()


def _is_mutual(db: Session, a: int, b: int) -> bool:
    ea, eb = _edge(db, a, b), _edge(db, b, a)
    return bool(ea and eb and ea.status == "ACCEPTED" and eb.status == "ACCEPTED")


@router.post("/follow")
def follow(body: dict, s: Student = Depends(current_student),
           db: Session = Depends(get_db)):
    try:
        target = int(body.get("student_id"))
    except (TypeError, ValueError):
        raise HTTPException(422, "student_id must be an integer id")
    if target == s.student_id:
        raise HTTPException(400, "Cannot follow yourself")
    if not db.get(Student, target):
        raise HTTPException(404, "Student not found")

    mine = _edge(db, s.student_id, target)
    theirs = _edge(db, target, s.student_id)

    if not mine:
        mine = UserFollow(follower_id=s.student_id, following_id=target, status="PENDING")
        db.add(mine)
        db.commit()
        return {"status": "REQUESTED", "mutual": False}

    return {
        "status": "MUTUAL" if _is_mutual(db, s.student_id, target) else ("FOLLOWING" if mine.status == "ACCEPTED" else "REQUESTED"),
        "mutual": _is_mutual(db, s.student_id, target)
    }


@router.post("/unfollow")
def unfollow(body: dict, s: Student = Depends(current_student),
             db: Session = Depends(get_db)):
    try:
        target = int(body.get("student_id"))
    except (TypeError, ValueError):
        raise HTTPException(422, "student_id must be an integer id")
    if not db.get(Student, target):
        raise HTTPException(404, "Student not found")

    mine = _edge(db, s.student_id, target)
    if mine:
        db.delete(mine)
        db.commit()

    theirs = _edge(db, target, s.student_id)
    if theirs and theirs.status == "ACCEPTED":
        return {"status": "FOLLOWS_YOU", "mutual": False}
    return {"status": "NONE", "mutual": False}


@router.get("/requests")
def list_requests(s: Student = Depends(current_student),
                  db: Session = Depends(get_db)):
    """Incoming follow requests awaiting my acceptance."""
    rows = (db.query(UserFollow, Student)
            .join(Student, Student.student_id == UserFollow.follower_id)
            .filter(UserFollow.following_id == s.student_id,
                    UserFollow.status == "PENDING").all())
    return {"requests": [{"student_id": str(stu.student_id), "name": stu.name}
                         for uf, stu in rows]}


@router.post("/requests/accept")
def accept_request(body: dict, s: Student = Depends(current_student),
                   db: Session = Depends(get_db)):
    try:
        requester = int(body.get("student_id"))
    except (TypeError, ValueError):
        raise HTTPException(422, "student_id must be an integer id")
    req = _edge(db, requester, s.student_id)
    if not req or req.status != "PENDING":
        raise HTTPException(404, "No pending request from this student")
    req.status = "ACCEPTED"
    db.commit()
    return {"accepted": True,
            "mutual": _is_mutual(db, s.student_id, requester)}


@router.post("/requests/accept_all")
def accept_all_requests(s: Student = Depends(current_student),
                        db: Session = Depends(get_db)):
    """Accept every pending incoming follow request at once."""
    rows = (db.query(UserFollow)
            .filter_by(following_id=s.student_id, status="PENDING").all())
    for r in rows:
        r.status = "ACCEPTED"
    db.commit()
    return {"accepted": len(rows)}


@router.post("/requests/reject")
def reject_request(body: dict, s: Student = Depends(current_student),
                   db: Session = Depends(get_db)):
    try:
        requester = int(body.get("student_id"))
    except (TypeError, ValueError):
        raise HTTPException(422, "student_id must be an integer id")
    req = _edge(db, requester, s.student_id)
    if not req or req.status != "PENDING":
        raise HTTPException(404, "No pending request from this student")
    db.delete(req)
    db.commit()
    return {"rejected": True}


@router.get("/compare/{other_id}")
def compare_timetables(other_id: int, s: Student = Depends(current_student),
                       db: Session = Depends(get_db)):
    """Overlay my timetable with a follower's: common classes, one-sided
    classes and common free slots, cell-by-cell over the master matrix."""
    other = db.get(Student, other_id)
    if not other:
        raise HTTPException(404, "Student not found")
    if other.student_id == s.student_id:
        raise HTTPException(400, "Cannot compare with yourself")
    edge = db.query(UserFollow).filter(
        ((UserFollow.follower_id == s.student_id) & (UserFollow.following_id == other.student_id))
        | ((UserFollow.follower_id == other.student_id) & (UserFollow.following_id == s.student_id)),
        UserFollow.status == "ACCEPTED").first()
    if not edge:
        raise HTTPException(403, "You can only compare with accepted followers/people you follow")

    def token_map(sid: int) -> dict[str, dict]:
        rows = (db.query(Enrollment, ClassOffering)
                .join(ClassOffering, (ClassOffering.course_code == Enrollment.course_code)
                      & (ClassOffering.class_id == Enrollment.class_id))
                .filter(Enrollment.student_id == sid,
                        Enrollment.status == "CONFIRMED").all())
        out = {}
        for enr, co in rows:
            toks = [t.strip().upper() for t in (enr.slot_tokens or "").split("+")
                    if t.strip() and t.strip().upper() != "NIL"]
            if not toks:
                toks = [t for (t,) in db.query(ClassSlotBreakdown.slot_token)
                        .filter_by(course_code=enr.course_code, class_id=enr.class_id).all()]
            title = co.course.course_title if co.course else co.course_code
            for tok in toks:
                out[tok] = {"course": co.course_code, "title": title, "venue": co.venue}
        return out

    mine, theirs = token_map(s.student_id), token_map(other.student_id)

    # Merge theory + lab at each time index into a single row per day
    grid = []
    counts = {"common": 0, "both_busy": 0, "mine": 0, "theirs": 0, "both_free": 0}
    for day in DAYS:
        row = []
        theory_toks = MASTER_SCHEDULE_MATRIX[day]["THEORY"]
        lab_toks = MASTER_SCHEDULE_MATRIX[day]["LAB"]
        for idx in range(12):
            tt = theory_toks[idx]
            lt = lab_toks[idx]
            # What does each user have at this time position?
            my_t = mine.get(tt) if tt != "-" else None
            my_l = mine.get(lt) if lt != "-" else None
            their_t = theirs.get(tt) if tt != "-" else None
            their_l = theirs.get(lt) if lt != "-" else None
            my_info = my_t or my_l
            their_info = their_t or their_l

            if my_info and their_info:
                if my_info["course"] == their_info["course"]:
                    state = "common"
                    counts["common"] += 1
                    row.append({"state": state,
                                "course": my_info["course"],
                                "title": my_info["title"],
                                "venue": my_info.get("venue")})
                else:
                    state = "both_busy"
                    counts["both_busy"] += 1
                    row.append({"state": state})
            elif my_info:
                counts["mine"] += 1
                row.append({"state": "mine"})
            elif their_info:
                counts["theirs"] += 1
                row.append({"state": "theirs"})
            else:
                counts["both_free"] += 1
                row.append({"state": "both_free"})
        grid.append({"day": day, "row": row})

    return {"peer": {"student_id": str(other.student_id), "name": other.name},
            "days": DAYS, "time_slots": THEORY_TIME_SLOTS,
            "grid": grid, "summary": counts}


@router.get("/followers")
def followers(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    def names(rows):
        out = []
        for f in rows:
            u = db.get(Student, f.follower_id if f.follower_id != s.student_id
                       else f.following_id)
            out.append({"student_id": str(u.student_id), "name": u.name,
                        "email": u.email, "bio": u.bio, "phone": u.phone,
                        "instagram": u.instagram, "facebook": u.facebook})
        return out

    my_followers = [f for f in db.query(UserFollow).filter_by(following_id=s.student_id)
                    if f.status == "ACCEPTED"]
    my_following = [f for f in db.query(UserFollow).filter_by(follower_id=s.student_id)
                    if f.status == "ACCEPTED"]
    follower_ids = {f.follower_id for f in my_followers}
    following_ids = {f.following_id for f in my_following}
    return {
        "followers": names(my_followers),
        "following": names(my_following),
        "mutual": [str(x) for x in follower_ids & following_ids],
    }


class MessageIn(BaseModel):
    receiver_id: int
    message_text: str


@router.post("/message")
def send_message(body: MessageIn, s: Student = Depends(current_student),
                 db: Session = Depends(get_db)):
    if not _is_mutual(db, s.student_id, body.receiver_id):
        raise HTTPException(403, "Direct chat requires an accepted mutual follow")
    if not 1 <= len(body.message_text) <= 2000:
        raise HTTPException(422, "Message length must be 1-2000 chars")
    m = ChatMessage(sender_id=s.student_id, receiver_id=body.receiver_id,
                    message_text=body.message_text)
    db.add(m)
    db.commit()
    return {"message_id": m.message_id, "sent_at": str(m.sent_at)}


@router.get("/messages/{other_id}")
def get_messages(other_id: int, s: Student = Depends(current_student),
                 db: Session = Depends(get_db)):
    if not _is_mutual(db, s.student_id, other_id):
        raise HTTPException(403, "Direct chat requires an accepted mutual follow")
    msgs = (db.query(ChatMessage)
            .filter(((ChatMessage.sender_id == s.student_id) &
                     (ChatMessage.receiver_id == other_id)) |
                    ((ChatMessage.sender_id == other_id) &
                     (ChatMessage.receiver_id == s.student_id)))
            .order_by(ChatMessage.sent_at).all())
    return [{"from": str(m.sender_id), "text": m.message_text,
             "sent_at": str(m.sent_at), "is_read": m.is_read} for m in msgs]
