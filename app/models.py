from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (Boolean, CheckConstraint, Column, DateTime, ForeignKey,
                        Index, Integer, String, Text, UniqueConstraint, text)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
import json

from .database import Base


class GUID(TypeDecorator):
    """UUID that works on both PostgreSQL and SQLite."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(UUID(as_uuid=True)) if dialect.name == "postgresql" \
            else dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value) if dialect.name != "postgresql" else value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return value if dialect.name == "postgresql" else uuid.UUID(value)


class StringArray(TypeDecorator):
    """TEXT[] on PostgreSQL, JSON-encoded TEXT on SQLite."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(ARRAY(Text)) if dialect.name == "postgresql" \
            else dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return value if dialect.name == "postgresql" else json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return value if dialect.name == "postgresql" else json.loads(value)


class Student(Base):
    __tablename__ = "students"
    student_id = Column(GUID, primary_key=True, default=uuid.uuid4)
    roll_no = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    bio = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Course(Base):
    __tablename__ = "courses"
    course_code = Column(String(12), primary_key=True)
    course_title = Column(String(150), nullable=False)
    credits = Column(Integer)
    course_category = Column(String(30))


class Faculty(Base):
    __tablename__ = "faculty"
    faculty_id = Column(Integer, primary_key=True)
    faculty_name = Column(String(120), nullable=False)


class ClassOffering(Base):
    __tablename__ = "class_offerings"
    class_id = Column(String(30), primary_key=True)
    course_code = Column(String(12), ForeignKey("courses.course_code"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty.faculty_id"), nullable=False)
    venue = Column(String(20))
    semester_id = Column(String(10), nullable=False)
    __table_args__ = (Index("idx_class_course_faculty", "course_code", "faculty_id"),)

    course = relationship("Course")
    faculty = relationship("Faculty")


class ClassSlotMapping(Base):
    __tablename__ = "class_slot_mapping"
    class_id = Column(String(30), ForeignKey("class_offerings.class_id", ondelete="CASCADE"),
                      primary_key=True)
    slot_token = Column(String(8), ForeignKey("slot_definitions.slot_token", ondelete="CASCADE"),
                        primary_key=True)


class SlotDefinition(Base):
    __tablename__ = "slot_definitions"
    slot_token = Column(String(8), primary_key=True)
    slot_type = Column(String(6), nullable=False)
    day_of_week = Column(String(3), nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"
    student_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"),
                        primary_key=True)
    class_id = Column(String(30), ForeignKey("class_offerings.class_id", ondelete="CASCADE"),
                      primary_key=True)
    enrolled_at = Column(DateTime, nullable=False,
                         server_default=text("CURRENT_TIMESTAMP"))
    status = Column(String(10), default="CONFIRMED", nullable=False)


class UserFollow(Base):
    __tablename__ = "user_follows"
    follower_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"),
                         primary_key=True)
    following_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"),
                          primary_key=True)
    followed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (CheckConstraint("follower_id <> following_id"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    message_id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    message_text = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_read = Column(Boolean, default=False)


class SlotSwapListing(Base):
    __tablename__ = "slot_swap_listings"
    listing_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(GUID, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    offered_class_id = Column(String(30),
                              ForeignKey("class_offerings.class_id", ondelete="CASCADE"),
                              nullable=False)
    desired_course_code = Column(String(12), ForeignKey("courses.course_code"), nullable=False)
    desired_slot_tokens = Column(StringArray)
    status = Column(String(10), default="OPEN", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SwapTransaction(Base):
    __tablename__ = "swap_transactions"
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(GUID, ForeignKey("students.student_id"), nullable=False)
    receiver_id = Column(GUID, ForeignKey("students.student_id"), nullable=False)
    sender_listing_id = Column(Integer, ForeignKey("slot_swap_listings.listing_id"), nullable=False)
    receiver_listing_id = Column(Integer, ForeignKey("slot_swap_listings.listing_id"), nullable=False)
    status = Column(String(12), default="PROPOSED", nullable=False)
