"""Grid aggregator engine: enrolled courses -> 5-day x 2-tier display matrix.

Follows the official MASTER_SCHEDULE_MATRIX exactly: each day renders a THEORY
row and a LAB row of 12 cells (6 morning, lunch, 6 afternoon/evening).
"""
from __future__ import annotations

from .slot_data import (DAYS, LAB_TIME_SLOTS, MASTER_SCHEDULE_MATRIX,
                        SLOT_DEFINITIONS, THEORY_TIME_SLOTS)

COLORS = ["#a78bfa", "#ff9440", "#c4b0ff", "#ffb066", "#8b5cf6",
          "#ff7e33", "#d8ccff", "#ffc49b"]


def build_student_grid(classes: list[dict]) -> dict:
    """classes: [{'CourseCode','CourseTitle','RoomNo','FacultyName','SlotTokens'}, ...]

    Returns:
    {
      "days": [...], "theory_slots": [12], "lab_slots": [12],
      "grid_view": [
        {"day":"MON",
         "theory_row":[{"occupied":true,"data":{...}} | {"occupied":false,"token":"A1"}],
         "lab_row":[...]} ...
    """
    # 1. token -> course content lookup
    token_to_course: dict[str, dict] = {}
    for cls in classes:
        for tok in cls.get("SlotTokens", []):
            token_to_course[tok.upper()] = {
                "course_code": cls.get("CourseCode"),
                "course_title": cls.get("CourseTitle"),
                "venue": cls.get("RoomNo"),
                "faculty": cls.get("FacultyName"),
                "token": tok.upper(),
                "color": COLORS[(hash(cls.get("CourseCode") or "") & 0xFFFF) % len(COLORS)],
                "is_lab": any(p["slot_type"] == "LAB" for p in SLOT_DEFINITIONS.get(tok.upper(), [])),
            }

    # 2. reconstruct the 5-day 2-tier table straight from the master matrix
    grid_view = []
    free_cells = 0
    for day in DAYS:
        rows = {}
        for tier, row_key in (("THEORY", "theory_row"), ("LAB", "lab_row")):
            row = []
            for tok in MASTER_SCHEDULE_MATRIX[day][tier]:
                if tok == "-":
                    row.append({"occupied": False, "token": None})
                    continue
                data = token_to_course.get(tok)
                if data:
                    row.append({"occupied": True, "data": dict(data, slot_token=tok)})
                else:
                    free_cells += 1
                    row.append({"occupied": False, "token": tok})
            rows[row_key] = row
        grid_view.append({"day": day, **rows})

    return {
        "days": DAYS,
        "theory_slots": THEORY_TIME_SLOTS,
        "lab_slots": LAB_TIME_SLOTS,
        "morning_hours": THEORY_TIME_SLOTS[:6],
        "afternoon_hours": THEORY_TIME_SLOTS[6:],
        "grid_view": grid_view,
        "free_cells": free_cells,
    }


# Backwards-compatible alias used by /api/timetable/grid
def build_weekly_grid(classes: list[dict]) -> dict:
    return build_student_grid(classes)
