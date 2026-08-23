from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student
from ..models import Student
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    roll_no: str
    name: str
    email: str
    password: str
    bio: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not body.email.endswith("@vitstudent.ac.in"):
        raise HTTPException(422, "Email must be a @vitstudent.ac.in address")
    if db.query(Student).filter_by(email=body.email).first():
        raise HTTPException(409, "Email already registered")
    if db.query(Student).filter_by(roll_no=body.roll_no).first():
        raise HTTPException(409, "Roll number already registered")
    s = Student(roll_no=body.roll_no, name=body.name, email=body.email,
                password_hash=hash_password(body.password), bio=body.bio)
    db.add(s)
    db.commit()
    return {"student_id": str(s.student_id), "token": create_token(s.student_id)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    s = db.query(Student).filter_by(email=body.email).first()
    if not s or not verify_password(body.password, s.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return {"student_id": str(s.student_id), "name": s.name,
            "token": create_token(s.student_id)}


@router.get("/me")
def me(s: Student = Depends(current_student)):
    return {"student_id": str(s.student_id), "roll_no": s.roll_no,
            "name": s.name, "email": s.email, "bio": s.bio}
