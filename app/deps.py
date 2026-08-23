from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Student
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_student(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Student:
    if creds is None:
        raise HTTPException(401, "Not authenticated")
    try:
        sid = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    student = db.get(Student, sid)
    if not student:
        raise HTTPException(401, "Unknown user")
    return student


def optional_student(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Student | None:
    if creds is None:
        return None
    try:
        return db.get(Student, decode_token(creds.credentials))
    except Exception:
        return None
