"""Instagram-style follow/unfollow + mutual detection + direct messages."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student
from ..models import ChatMessage, Student, UserFollow

router = APIRouter(prefix="/api/social", tags=["social"])


def _is_mutual(db: Session, a: UUID, b: UUID) -> bool:
    return bool(db.query(UserFollow).filter_by(follower_id=a, following_id=b).first()
                and db.query(UserFollow).filter_by(follower_id=b, following_id=a).first())


@router.post("/follow")
def follow(body: dict, s: Student = Depends(current_student),
           db: Session = Depends(get_db)):
    target = body.get("student_id")
    try:
        target_uuid = UUID(target)
    except (TypeError, ValueError):
        raise HTTPException(422, "student_id must be a UUID")
    if target_uuid == s.student_id:
        raise HTTPException(400, "Cannot follow yourself")
    if not db.get(Student, target_uuid):
        raise HTTPException(404, "Student not found")
    existing = db.query(UserFollow).filter_by(follower_id=s.student_id,
                                              following_id=target_uuid).first()
    if existing:  # toggle -> unfollow
        db.delete(existing)
        db.commit()
        return {"following": False}
    db.add(UserFollow(follower_id=s.student_id, following_id=target_uuid))
    db.commit()
    return {"following": True, "mutual": _is_mutual(db, s.student_id, target_uuid)}


@router.get("/followers")
def followers(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    def names(rows):
        out = []
        for f in rows:
            u = db.get(Student, f.follower_id if f.follower_id != s.student_id else f.following_id)
            out.append({"student_id": str(u.student_id), "name": u.name})
        return out

    my_followers = db.query(UserFollow).filter_by(following_id=s.student_id).all()
    my_following = db.query(UserFollow).filter_by(follower_id=s.student_id).all()
    follower_ids = {f.follower_id for f in my_followers}
    following_ids = {f.following_id for f in my_following}
    return {
        "followers": names(my_followers),
        "following": names(my_following),
        "mutual": [str(x) for x in follower_ids & following_ids],
    }


# ---------------- Direct chat (unlocked by mutual follow) ----------------
class MessageIn(BaseModel):
    receiver_id: str
    message_text: str


@router.post("/message")
def send_message(body: MessageIn, s: Student = Depends(current_student),
                 db: Session = Depends(get_db)):
    rid = UUID(body.receiver_id)
    if not _is_mutual(db, s.student_id, rid):
        raise HTTPException(403, "Direct chat requires a mutual follow")
    if not 1 <= len(body.message_text) <= 2000:
        raise HTTPException(422, "Message length must be 1-2000 chars")
    m = ChatMessage(sender_id=s.student_id, receiver_id=rid,
                    message_text=body.message_text)
    db.add(m)
    db.commit()
    return {"message_id": m.message_id, "sent_at": str(m.sent_at)}


@router.get("/messages/{other_id}")
def get_messages(other_id: str, s: Student = Depends(current_student),
                 db: Session = Depends(get_db)):
    oid = UUID(other_id)
    if not _is_mutual(db, s.student_id, oid):
        raise HTTPException(403, "Direct chat requires a mutual follow")
    msgs = (db.query(ChatMessage)
            .filter(((ChatMessage.sender_id == s.student_id) &
                     (ChatMessage.receiver_id == oid)) |
                    ((ChatMessage.sender_id == oid) &
                     (ChatMessage.receiver_id == s.student_id)))
            .order_by(ChatMessage.sent_at).all())
    return [{"from": str(m.sender_id), "text": m.message_text,
             "sent_at": str(m.sent_at), "is_read": m.is_read} for m in msgs]
