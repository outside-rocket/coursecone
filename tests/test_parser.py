"""Unit tests for the multi-line portal clipboard parser (master spec §2)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from parser import parse_portal_text, parse_block

RAW = """
1
General (Semester)
BCSE302L - Database Systems
( Theory Only )
3 0 0 0 3.0
Discipline Core
Regular
CH2026270100945
A1+TA1 -
AB3-505
HELEN VIJITHA P -
SCOPE
27-Jun-2026 10:47
28-Jun-2026 - Manual
Registered and Approved

2
General (Semester)
BCSE302P - Database Systems Lab
( Lab Only )
0 0 2 0 1.0
Discipline Core
Regular
CH2026270100947
L11+L12 -
AB3-311
HELEN VIJITHA P -
SCOPE
27-Jun-2026 10:47
Registered and Approved

3
General (Semester)
BSSC102N - Indian Constitution
( Online Course )
0 0 0 0 2.0
Non-graded Core Requirement
Regular
CH2026270103311
NIL -
NIL
MANJARI SUGIRTHA A -
VITSOL
27-Jun-2026 10:21
Registered and Approved

4
General (Semester)
BMAT205L - Discrete Mathematics and Graph Theory
( Theory Only )
3 1 0 0 4.0
Discipline-linked Engineering Sciences
Regular
CH2026270100261
C1+TC1+TCC1 -
AB3-405
THANGARAJ M -
SAS
27-Jun-2026 10:22
Registered and Approved
"""


def test_record_boundaries():
    recs = parse_portal_text(RAW)
    assert len(recs) == 4


def test_course_metadata_split():
    r = parse_portal_text(RAW)[0]
    assert r["CourseCode"] == "BCSE302L"
    assert r["CourseTitle"] == "Database Systems"


def test_course_type_enums():
    recs = {r["CourseCode"]: r for r in parse_portal_text(RAW)}
    assert recs["BCSE302L"]["CourseType"] == "THEORY"
    assert recs["BCSE302P"]["CourseType"] == "LAB"
    assert recs["BSSC102N"]["CourseType"] == "ONLINE"


def test_credits_tuple():
    recs = {r["CourseCode"]: r for r in parse_portal_text(RAW)}
    b = recs["BCSE302L"]
    assert (b["L"], b["T"], b["P"], b["J"], b["Credits"]) == (3, 0, 0, 0, 3.0)
    m = recs["BMAT205L"]
    assert (m["L"], m["T"], m["P"], m["J"], m["Credits"]) == (3, 1, 0, 0, 4.0)


def test_class_id():
    r = parse_portal_text(RAW)[0]
    assert r["ClassID"] == "CH2026270100945"


def test_slot_and_venue_compound():
    recs = {r["CourseCode"]: r for r in parse_portal_text(RAW)}
    db = recs["BCSE302L"]
    assert db["SlotTokens"] == ["A1", "TA1"] and db["Venue"] == "AB3-505"
    mat = recs["BMAT205L"]
    assert mat["SlotTokens"] == ["C1", "TC1", "TCC1"]
    lab = recs["BCSE302P"]
    assert lab["SlotTokens"] == ["L11", "L12"]


def test_nil_slots():
    r = parse_portal_text(RAW)[2]
    assert r["SlotTokens"] == [] and r["Venue"] in (None, "NIL")


def test_faculty_school():
    r = parse_portal_text(RAW)[0]
    assert r["FacultyName"] == "HELEN VIJITHA P" and r["School"] == "SCOPE"


def test_status_and_timestamp():
    r = parse_portal_text(RAW)[0]
    assert "Registered" in r["Status"]
    assert r["RegisteredAt"] == "27-Jun-2026 10:47"


def test_soft_skill_enum():
    raw = RAW.replace("( Online Course )", "( Soft Skill )")
    assert parse_portal_text(raw)[2]["CourseType"] == "SOFT_SKILL"


def test_empty_payload_raises():
    try:
        parse_portal_text("no courses here")
        assert False, "expected ValueError"
    except ValueError:
        pass


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed")
