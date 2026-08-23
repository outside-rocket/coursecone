"""Multi-line FFCS registration parser (deterministic state machine).

Handles the real pasted portal format where course records are bounded by
numeric indices and fields arrive on separate lines, e.g.:

    1
    BCSE302L - Database Systems
    Theory Only
    3 0 0 0 3.0
    Discipline Core
    Regular
    CH2026270100945
    A1+TA1
    AB3-505
    HELEN VIJITHA P - SCOPE
    27-Jun-2026 10:47
    Registered and Approved

Returns a list of clean JSON-ready dicts.
"""
from __future__ import annotations

import re
from datetime import datetime

COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b\s*[-–:]?\s*(.*)")
COURSE_TYPES = ("Theory Only", "Lab Only", "Theory + Practical", "Embedded Theory",
                "Embedded Lab", "Online Course", "Soft Skill", "Project", "Studio")
CREDITS_RE = re.compile(r"^\s*(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d(?:\.\d)?)\s*$")
CLASS_ID_RE = re.compile(r"\bCH\d{13}\b")
SLOT_LINE_RE = re.compile(r"^\s*(NIL|[A-Z]{1,3}\d{1,2}(?:\+[A-Z]{1,3}\d{1,2})*)\s*$")
VENUE_RE = re.compile(r"\b([A-Z0-9]{2,6}-[A-Z0-9]{2,5}|NIL)\b")
SCHOOLS = ("SCORE", "SCOPE", "SENSE", "SAS", "VITBS", "VITBC", "VEC", "ACAD", "SELECT", "TRACE")
TIMESTAMP_RE = re.compile(r"\b(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2})\b")
REG_NO_RE = re.compile(r"^\d{2}[A-Z]{3}\d{4}$")          # 24BCE1568, 13BEC1667 ...
FACULTY_LINE_RE = re.compile(r"^\s*([A-Z][A-Z.\s]{3,60}?)\s*(?:[-–]\s*(\w+))?\s*$")
CATEGORY_KEYWORDS = ("core", "elective", "sciences", "project", "practice",
                     "mandatory", "audit", "foundation")


def is_record_start(line: str) -> bool:
    return bool(re.fullmatch(r"\d{1,2}", line.strip()))


def parse_block(block: list[str]) -> dict | None:
    """Extract one course record from its numbered block via deterministic regexes."""
    rec = {
        "CourseCode": None, "CourseTitle": None, "CourseType": None,
        "L": 0, "T": 0, "P": 0, "J": 0, "Credits": 0.0,
        "CourseCategory": None, "CourseOption": None,
        "ClassID": None, "SlotTokens": [], "Venue": None,
        "FacultyName": None, "School": None,
        "RegisteredAt": None, "Status": None,
    }
    for raw in block:
        line = raw.strip()
        if not line:
            continue

        # 1. course code + title
        m = COURSE_CODE_RE.search(line)
        if m and not rec["CourseCode"]:
            rec["CourseCode"] = m.group(1).upper()
            title = m.group(2).strip()
            # title line may carry the type suffix ("... | Theory Only")
            for ct in COURSE_TYPES:
                if ct.lower() in title.lower():
                    rec["CourseType"] = ct
                    title = re.sub(re.escape(ct), "", title, flags=re.I).strip(" |-–")
                    break
            rec["CourseTitle"] = title or None
            continue

        # 2. explicit course-type line
        if rec["CourseType"] is None:
            for ct in COURSE_TYPES:
                if ct.lower() == line.lower():
                    rec["CourseType"] = ct
                    break
            if rec["CourseType"]:
                continue

        # 3. L T P J C credit tuple
        m = CREDITS_RE.match(line)
        if m and rec["Credits"] == 0.0:
            rec["L"], rec["T"], rec["P"], rec["J"] = map(int, m.groups()[:4])
            rec["Credits"] = float(m.group(5))
            continue

        # 4. category / option
        low = line.lower()
        if rec["CourseCategory"] is None and any(k in low for k in CATEGORY_KEYWORDS) \
                and not rec["ClassID"]:
            rec["CourseCategory"] = line
            continue
        if rec["CourseOption"] is None and low in ("regular", "hard", "soft"):
            rec["CourseOption"] = line
            continue

        # 5. class id
        m = CLASS_ID_RE.search(line)
        if m:
            rec["ClassID"] = m.group(0)
            continue

        # 6. slot expression
        if rec["ClassID"] and not rec["SlotTokens"] and SLOT_LINE_RE.match(line):
            rec["SlotTokens"] = [] if line.upper() == "NIL" else line.upper().split("+")
            continue

        # 7. venue
        m = VENUE_RE.search(line)
        if m and rec["ClassID"] and rec["Venue"] is None and not rec["FacultyName"]:
            rec["Venue"] = None if m.group(1) == "NIL" else m.group(1)
            continue

        # 8. timestamp
        m = TIMESTAMP_RE.search(line)
        if m:
            rec["RegisteredAt"] = m.group(1)
            continue

        # 9. status
        if re.search(r"registered|approved|pending|dropped", low):
            rec["Status"] = line
            continue

        # 10. faculty line: ALL-CAPS name [- SCHOOL]
        m = FACULTY_LINE_RE.match(line)
        if m and rec["FacultyName"] is None and line == line.upper():
            rec["FacultyName"] = m.group(1).strip()
            if m.group(2) and m.group(2).upper() in SCHOOLS:
                rec["School"] = m.group(2).upper()
            continue

        # school on its own line
        if line.upper() in SCHOOLS:
            rec["School"] = line.upper()

    if not rec["CourseCode"]:
        return None
    if rec["CourseType"] is None:                       # infer from slots
        if rec["SlotTokens"] and all(t.startswith("L") for t in rec["SlotTokens"]):
            rec["CourseType"] = "Lab Only"
        elif rec["SlotTokens"]:
            rec["CourseType"] = "Theory Only"
    return rec


def parse_portal_text(raw: str) -> list[dict]:
    """Split the clipboard payload into numbered blocks and parse each one."""
    lines = [ln.strip() for ln in re.split(r"[\r\n]+", raw) if ln.strip()]
    blocks: list[list[str]] = []
    current: list[str] | None = None
    for ln in lines:
        if is_record_start(ln):
            if current:
                blocks.append(current)
            current = []
        elif current is not None:
            current.append(ln)
    if current:
        blocks.append(current)

    records = [r for r in (parse_block(b) for b in blocks) if r]
    if not records:
        raise ValueError("No course records found in the pasted text")
    return records


def parse_reg_no(roll: str) -> bool:
    """24BCE1568 / 13BEC1667 style registration numbers."""
    return bool(REG_NO_RE.match((roll or "").strip().upper()))


def parse_timestamp(ts: str):
    try:
        return datetime.strptime(ts, "%d-%b-%Y %H:%M")
    except (TypeError, ValueError):
        return None
