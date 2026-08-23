from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import SECRET_KEY, TOKEN_EXPIRE_MINUTES

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(student_id: uuid.UUID) -> str:
    payload = {"sub": str(student_id),
               "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> uuid.UUID:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return uuid.UUID(payload["sub"])
