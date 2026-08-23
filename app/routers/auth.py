from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import parser as portal
from ..database import get_db
from ..deps import current_student
from ..models import Person, Student
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
    roll = body.roll_no.strip().upper()
    if not portal.parse_reg_no(roll):
        raise HTTPException(422, "Roll no must look like 24BCE1568")
    if not body.email.endswith("@vitstudent.ac.in"):
        raise HTTPException(422, "Email must be a @vitstudent.ac.in address")
    if db.query(Student).filter_by(roll_no=roll).first():
        raise HTTPException(409, "Roll number already registered")
    if db.query(Person).filter_by(email=body.email.lower()).first():
        raise HTTPException(409, "Email already registered")

    person = Person(full_name=body.name.strip(), email=body.email.lower(),
                    password_hash=hash_password(body.password))
    db.add(person)
    db.flush()
    student = Student(student_id=person.person_id, roll_no=roll, bio=body.bio)
    db.add(student)
    db.commit()
    return {"student_id": student.student_id, "token": create_token(student.student_id)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    person = db.query(Person).filter_by(email=body.email.lower()).first()
    if not person or not verify_password(body.password, person.password_hash):
        raise HTTPException(401, "Invalid credentials")
    student = db.get(Student, person.person_id)
    if not student:
        raise HTTPException(403, "Student account required")
    return {"student_id": student.student_id, "name": person.full_name,
            "token": create_token(student.student_id)}


@router.get("/me")
def me(s: Student = Depends(current_student)):
    return {"student_id": s.student_id, "roll_no": s.roll_no,
            "name": s.name, "email": s.email, "bio": s.bio}
