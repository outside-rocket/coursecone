"""Weekly grid transformation engine: flat enrollment records ->
two-tier (Theory / Lab) Day-Hour matrix matching the FFCS timetable view."""
from __future__ import annotations

from datetime import time

from .slot_data import DAYS, LUNCH, get_slot

MORNING_HOURS = [
    ("08:00-08:50", time(8, 0), time(8, 50)),
    ("09:00-09:50", time(9, 0), time(9, 50)),
    ("10:00-10:50", time(10, 0), time(10, 50)),
    ("11:00-11:50", time(11, 0), time(11, 50)),
    ("12:00-12:50", time(12, 0), time(12, 50)),
]
AFTERNOON_HOURS = [
    ("14:00-14:50", time(14, 0), time(14, 50)),
    ("15:00-15:50", time(15, 0), time(15, 50)),
    ("16:00-16:50", time(16, 0), time(16, 50)),
    ("17:00-17:50", time(17, 0), time(17, 50)),
    ("18:00-18:50", time(18, 0), time(19, 0)),
]

COLORS = ["#FFE082", "#A5D6A7", "#90CAF9", "#CE93D8", "#FFAB91",
          "#80CBC4", "#F48FB1", "#BCAAA4"]


def _cell(course_code, title, venue, faculty, slot_token):
    return {"course_code": course_code, "course_title": title,
            "venue": venue, "faculty": faculty,
            "slot_token": slot_token,
            "color": COLORS[(hash(course_code) & 0xFFFF) % len(COLORS)]}


def build_weekly_grid(classes: list[dict]) -> dict:
    """classes: [{'CourseCode','CourseTitle','RoomNo','FacultyName','SlotTokens'}, ...]

    Returns {'theory': rows x days matrix, 'lab': same} where each cell is
    None (free) or a cell dict; free cells are rendered highlighted.
    """
    theory = [[None] * len(DAYS) for _ in MORNING_HOURS + AFTERNOON_HOURS]
    lab = {}

    for cls in classes:
        for token in cls.get("SlotTokens", []):
            sd = get_slot(token)
            if not sd:
                continue
            day = sd["day_of_week"]
            if sd["slot_type"] == "THEORY":
                for ridx, (_, s, e) in enumerate(MORNING_HOURS + AFTERNOON_HOURS):
                    if sd["start_time"] == s:
                        theory[ridx][DAYS.index(day)] = _cell(
                            cls["CourseCode"], cls["CourseTitle"],
                            cls.get("RoomNo"), cls.get("FacultyName"), token)
                        break
            else:
                key = f"{day} {sd['start_time'].strftime('%H:%M')}"
                if key not in lab:
                    lab[key] = {"day": day,
                                "time": f"{sd['start_time'].strftime('%H:%M')}-{sd['end_time'].strftime('%H:%M')}",
                                "entries": []}
                lab[key]["entries"].append(_cell(
                    cls["CourseCode"], cls["CourseTitle"],
                    cls.get("RoomNo"), cls.get("FacultyName"), token))

    return {
        "days": DAYS,
        "lunch": LUNCH[0].strftime("%H:%M"),
        "morning_hours": [h[0] for h in MORNING_HOURS],
        "afternoon_hours": [h[0] for h in AFTERNOON_HOURS],
        "theory": theory,
        "lab": sorted(lab.values(), key=lambda r: (DAYS.index(r["day"]), r["time"])),
        "free_cells": sum(1 for row in theory for c in row if c is None),
    }
