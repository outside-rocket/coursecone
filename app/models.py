"""ORM mirroring database/schema.sql — EER PERSON superclass, weak-entity
CLASS_OFFERING with composite PK, 1NF class_slot_breakdown."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (Boolean, CheckConstraint, Column, DateTime, ForeignKey,
                        ForeignKeyConstraint, Index, Integer, Numeric, SmallInteger,
                        String, Text, text)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator

from .database import Base


class StringArray(TypeDecorator):
    """TEXT[] on PostgreSQL, JSON-encoded TEXT on SQLite."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(ARRAY(Text)) if dialect.name == "postgresql" \
            else dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        import json
        return value if value is None or dialect.name == "postgresql" else json.dumps(value)

    def process_result_value(self, value, dialect):
        import json
        if value is None or dialect.name == "postgresql":
            return value
        return json.loads(value)


# ---------------- EER: PERSON superclass, Option-8A subclasses ----------------
class Person(Base):
    __tablename__ = "person"
    person_id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Student(Base):
    __tablename__ = "student"
    # shared-PK inheritance: student_id IS the person_id
    student_id = Column(Integer, ForeignKey("person.person_id", ondelete="CASCADE"),
                        primary_key=True)
    roll_no = Column(String(12), unique=True, nullable=False)
    bio = Column(Text)
    phone = Column(String(20))
    instagram = Column(String(60))
    facebook = Column(String(60))
    linkedin = Column(String(80))
    reddit = Column(String(60))
    dob = Column(String(10))
    person = relationship("Person", lazy="joined")

    @property
    def name(self): return self.person.full_name
    @property
    def email(self): return self.person.email


class Faculty(Base):
    __tablename__ = "faculty"
    person_id = Column(Integer, ForeignKey("person.person_id", ondelete="CASCADE"),
                       primary_key=True)
    emp_no = Column(Integer, unique=True, nullable=False)
    school = Column(String(10))
    person = relationship("Person", lazy="joined")


class Course(Base):
    __tablename__ = "course"
    course_code = Column(String(12), primary_key=True)
    course_title = Column(String(150), nullable=False)
    course_type = Column(String(20))
    l = Column(SmallInteger, default=0)
    t = Column(SmallInteger, default=0)
    p = Column(SmallInteger, default=0)
    j = Column(SmallInteger, default=0)
    credits = Column(Numeric(3, 1))
    course_category = Column(String(60))
    course_option = Column(String(12))


class SlotDefinition(Base):
    __tablename__ = "slot_definitions"
    slot_token = Column(String(8), primary_key=True)
    slot_type = Column(String(6), nullable=False)
    day_of_week = Column(String(3), nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)


# -------- weak entity: identified by owner COURSE + discriminator class_id --------
class ClassOffering(Base):
    __tablename__ = "class_offering"
    __table_args__ = (
        CheckConstraint("class_id LIKE 'CH%'"),   # PG uses regex; SQLite falls back
        Index("idx_class_course_faculty", "course_code", "faculty_id"),
    )
    course_code = Column(String(12), ForeignKey("course.course_code"), primary_key=True)
    class_id = Column(String(20), primary_key=True)
    faculty_id = Column(Integer, ForeignKey("faculty.person_id"), nullable=False)
    slot_string = Column(String(60))              # raw compound value, e.g. "A1+TA1"
    venue = Column(String(20))
    semester_id = Column(String(10), nullable=False)

    course = relationship("Course", lazy="joined")
    faculty = relationship("Faculty", lazy="joined")


class ClassSlotBreakdown(Base):
    """Multivalued slot attribute decomposed into atomic rows (1NF/BCNF)."""
    __tablename__ = "class_slot_breakdown"
    course_code = Column(String(12), primary_key=True)
    class_id = Column(String(20), primary_key=True)
    slot_token = Column(String(8),
                        ForeignKey("slot_definitions.slot_token", ondelete="CASCADE"),
                        primary_key=True)
    __table_args__ = (
        ForeignKeyConstraint(["course_code", "class_id"],
                             ["class_offering.course_code", "class_offering.class_id"],
                             ondelete="CASCADE"),
        Index("idx_breakdown_slot", "slot_token"),
    )


class Enrollment(Base):
    __tablename__ = "enrollment"
    student_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                        primary_key=True)
    course_code = Column(String(12), primary_key=True)
    class_id = Column(String(20), primary_key=True)
    enrolled_at = Column(DateTime, nullable=False,
                         server_default=text("CURRENT_TIMESTAMP"))
    status = Column(String(10), default="CONFIRMED", nullable=False)
    slot_tokens = Column(String(60))
    __table_args__ = (
        ForeignKeyConstraint(["course_code", "class_id"],
                             ["class_offering.course_code", "class_offering.class_id"],
                             ondelete="CASCADE"),
    )


class UserFollow(Base):
    """Directed follow edge. status: PENDING (request sent) -> ACCEPTED."""
    __tablename__ = "user_follows"
    follower_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                         primary_key=True)
    following_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                          primary_key=True)
    followed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(10), default="PENDING", nullable=False)  # PENDING | ACCEPTED
    __table_args__ = (CheckConstraint("follower_id <> following_id"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    message_id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                       nullable=False)
    receiver_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                         nullable=False)
    message_text = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_read = Column(Boolean, default=False)


class SwapListing(Base):
    __tablename__ = "swap_listing"
    listing_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                        nullable=False)
    offered_course_code = Column(String(12), primary_key=False, nullable=False)
    offered_class_id = Column(String(20), nullable=False)
    desired_course_code = Column(String(12), ForeignKey("course.course_code"), nullable=False)
    desired_slot_tokens = Column(StringArray)
    status = Column(String(10), default="OPEN", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(["offered_course_code", "offered_class_id"],
                             ["class_offering.course_code", "class_offering.class_id"],
                             ondelete="CASCADE"),
        Index("idx_listing_status", "status", "desired_course_code"),
    )


class SwapInterest(Base):
    """A student raising a hand for an open listing ('I want this slot')."""
    __tablename__ = "swap_interest"
    listing_id = Column(Integer, ForeignKey("swap_listing.listing_id", ondelete="CASCADE"),
                        primary_key=True)
    student_id = Column(Integer, ForeignKey("student.student_id", ondelete="CASCADE"),
                        primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SwapTransaction(Base):
    __tablename__ = "swap_transactions"
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("student.student_id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("student.student_id"), nullable=False)
    sender_listing_id = Column(Integer, ForeignKey("swap_listing.listing_id"), nullable=False)
    receiver_listing_id = Column(Integer, ForeignKey("swap_listing.listing_id"), nullable=False)
    status = Column(String(12), default="PROPOSED", nullable=False)
    executed_at = Column(DateTime)
