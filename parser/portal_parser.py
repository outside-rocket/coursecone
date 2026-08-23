"""Robust parser for raw clipboard text / HTML pasted from the VIT
registration portal (FFCS timetable view) into clean relational records.

Accepts either tab-separated text rows or HTML <table> markup and returns
a list of dicts with decomposed attributes:
  CourseCode, CourseTitle, CourseType, Credits, CourseCategory,
  ClassID, FacultyEmpID, FacultyName, RoomNo, SlotTokens
"""
from __future__ import annotations

import html as htmllib
import re
from io import StringIO

import pandas as pd

COLUMNS = [
    "Course Code & Title", "Credit", "Course Category", "Course Option",
    "Class Detail", "Slot", "Faculty Details", "Status",
]


def _strip_html(raw: str) -> str:
    if "<table" not in raw.lower():
        return raw
    tables = pd.read_html(StringIO(raw))
    if not tables:
        raise ValueError("No HTML table found in pasted content")
    df = tables[0]
    return df.to_csv(sep="\t", index=False, header=True)


def parse_course_code_title(value: str) -> tuple[str, str]:
    """'BCSE302L - Data Structures and Algorithms' -> ('BCSE302L', 'Data...')"""
    m = re.match(r"\s*([A-Z]{2,4}\d{3,4}[A-Z]?)\s*[-–:]?\s*(.*)", value or "")
    if not m:
        return "", (value or "").strip()
    return m.group(1).upper(), m.group(2).strip()


def parse_class_detail(value: str) -> dict:
    """'CH2026270100945 - 53616 - AB3-505' -> ClassID / FacultyEmpID / RoomNo."""
    parts = [p.strip() for p in re.split(r"\s+-\s+", value or "")]
    class_id = parts[0] if parts else ""
    emp_id = None
    room_parts = []
    for p in parts[1:]:
        if emp_id is None and re.fullmatch(r"\d{4,7}", p):
            emp_id = int(p)
        else:
            room_parts.append(p)
    room = "-".join(room_parts) if room_parts else None
    return {"ClassID": class_id, "FacultyEmpID": emp_id, "RoomNo": room}


def parse_faculty(value: str) -> tuple[str | None, str]:
    """'Dr. Ramesh Kumar (53616)' or 'Ramesh Kumar - 53616'."""
    value = value or ""
    m = re.search(r"\(?\s*(\d{4,7})\s*\)?", value)
    emp_id = int(m.group(1)) if m else None
    name = re.sub(r"\(?\s*\d{4,7}\s*\)?", "", value).strip(" -")
    return emp_id, name


def parse_slots(value: str) -> list[str]:
    """'A1+TA1' / 'L11+L12' / 'NIL' -> ['A1','TA1'] etc."""
    value = (value or "").strip().upper()
    if not value or value == "NIL":
        return []
    return [t for t in re.split(r"\+", value) if t]


def detect_course_type(code: str, tokens: list[str]) -> str:
    lab_only = bool(tokens) and all(t.startswith("L") for t in tokens)
    if code.endswith(("P", "L1")) or (lab_only and code.endswith("P")):
        return "Lab"
    if lab_only:
        return "Embedded"   # theory+lab combined handled by paired rows
    if any(t.startswith("L") for t in tokens):
        return "Embedded"
    return "Theory"


def parse_portal_text(raw: str) -> list[dict]:
    text = _strip_html(raw)
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    # locate header row; fall back to positional parsing
    start = 0
    for i, ln in enumerate(lines):
        if "Course Code" in ln or ln.split("\t")[0].strip().lower() == "course code & title":
            start = i + 1
            break
    records: list[dict] = []
    for ln in lines[start:]:
        cells = [c.strip() for c in ln.split("\t")]
        while len(cells) < len(COLUMNS):
            cells.append("")
        row = dict(zip(COLUMNS, cells))
        if not row["Course Code & Title"] or row["Course Code & Title"].lower().startswith("total"):
            continue
        code, title = parse_course_code_title(row["Course Code & Title"])
        cls = parse_class_detail(row["Class Detail"])
        emp_id, fac_name = parse_faculty(row["Faculty Details"])
        tokens = parse_slots(row["Slot"])
        credits = re.sub(r"\D", "", row["Credit"]) or None
        records.append({
            "CourseCode": code,
            "CourseTitle": title,
            "Credits": int(credits) if credits else None,
            "CourseCategory": row["Course Category"],
            "CourseType": detect_course_type(code, tokens),
            **cls,
            "FacultyName": fac_name or None,
            "FacultyEmpID": emp_id or cls.get("FacultyEmpID"),
            "SlotTokens": tokens,
            "Status": row["Status"],
        })
    if not records:
        raise ValueError("Could not parse any course rows from the pasted text")
    return records


if __name__ == "__main__":
    sample = (
        "Course Code & Title\tCredit\tCourse Category\tCourse Option\t"
        "Class Detail\tSlot\tFaculty Details\tStatus\n"
        "BCSE302L - Data Structures and Algorithms\t4\tPC\tHard\t"
        "CH2026270100945 - 53616 - AB3-505\tA1+TA1\tDr. Ramesh Kumar (53616)\tRegistered\n"
        "BCSE305L - Operating Systems\t4\tPC\tHard\t"
        "CH2026270100946 - 53617 - AB2-104\tL11+L12\tDr. Priya Sharma (53617)\tRegistered\n"
    )
    import json
    print(json.dumps(parse_portal_text(sample), indent=2))
