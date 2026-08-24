"""Official VIT FFCS master schedule matrix -> token -> [placements] lookup.

Source of truth: MASTER_SCHEDULE_MATRIX below (exact day x tier x 12-slot grid).
A single token may appear on multiple days/cells (e.g. A1 -> MON 08:00, WED 09:50),
so every token maps to a LIST of placements across the two tiers.
"""
from datetime import time

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
LUNCH = (time(13, 25), time(14, 0))

THEORY_TIME_SLOTS = [
    "08:00-08:50", "08:55-09:45", "09:50-10:40", "10:45-11:35", "11:40-12:30", "12:35-13:25",
    "14:00-14:50", "14:55-15:45", "15:50-16:40", "16:45-17:35", "17:40-18:30", "18:35-19:25",
]

LAB_TIME_SLOTS = [
    "08:00-08:50", "08:51-09:40", "09:51-10:40", "10:41-11:30", "11:40-12:30", "12:31-13:20",
    "14:00-14:50", "14:51-15:40", "15:51-16:40", "16:41-17:30", "17:40-18:30", "18:31-19:20",
]

# EXACT MATRIX MAPPING: day -> {"THEORY": [12 slot codes], "LAB": [12 slot codes]}
# "-" marks an officially unallocated cell.
MASTER_SCHEDULE_MATRIX = {
    "MON": {
        "THEORY": ["A1", "F1", "D1", "TB1", "TG1", "S11", "A2", "F2", "D2", "TB2", "TG2", "S3"],
        "LAB":    ["L1", "L2", "L3", "L4",  "L5",  "L6",  "L31", "L32", "L33", "L34", "L35", "L36"],
    },
    "TUE": {
        "THEORY": ["B1", "G1", "E1", "TC1", "TAA1", "-",   "B2", "G2", "E2", "TC2", "TAA2", "S1"],
        "LAB":    ["L7", "L8", "L9", "L10", "L11",  "L12", "L37", "L38", "L39", "L40", "L41", "L42"],
    },
    "WED": {
        "THEORY": ["C1", "A1", "F1", "V1",  "V2",   "-",   "C2", "A2", "F2", "TD2", "TBB2", "S4"],
        "LAB":    ["L13", "L14", "L15", "L16", "L17", "L18", "L43", "L44", "L45", "L46", "L47", "L48"],
    },
    "THU": {
        "THEORY": ["D1", "B1", "G1", "TE1", "TCC1", "-",   "D2", "B2", "G2", "TE2", "TCC2", "S2"],
        "LAB":    ["L19", "L20", "L21", "L22", "L23", "L24", "L49", "L50", "L51", "L52", "L53", "L54"],
    },
    "FRI": {
        "THEORY": ["E1", "C1", "TA1", "TF1", "TD1", "-",  "E2", "C2", "TA2", "TF2", "TDD2", "-"],
        "LAB":    ["L25", "L26", "L27", "L28", "L29", "L30", "L55", "L56", "L57", "L58", "L59", "L60"],
    },
}


def _t(hhmm: str) -> time:
    h, m = hhmm.split(":")
    return time(int(h), int(m))


#: token -> [ {slot_token, slot_type, day_of_week, start_time, end_time}, ... ]
SLOT_DEFINITIONS: dict[str, list[dict]] = {}


def _register(tier: str, time_slots: list[str]):
    for day in DAYS:
        for idx, tok in enumerate(MASTER_SCHEDULE_MATRIX[day][tier]):
            if not tok or tok == "-":
                continue
            s, e = time_slots[idx].split("-")
            placement = {
                "slot_token": tok, "slot_type": tier,
                "day_of_week": day, "start_time": _t(s), "end_time": _t(e),
                "time_index": idx,
            }
            bucket = SLOT_DEFINITIONS.setdefault(tok, [])
            if placement not in bucket:
                bucket.append(placement)


_register("THEORY", THEORY_TIME_SLOTS)
_register("LAB", LAB_TIME_SLOTS)


def get_slot(token: str) -> list[dict]:
    """All weekly placements for a slot token (may be several)."""
    return SLOT_DEFINITIONS.get((token or "").strip().upper(), [])


def slots_overlap(tokens_a: list[str], tokens_b: list[str]) -> bool:
    """True if any placement pair overlaps in day+time."""
    pa = [p for t in tokens_a for p in get_slot(t)]
    pb = [p for t in tokens_b for p in get_slot(t)]
    for sa in pa:
        for sb in pb:
            if sa["time_index"] == sb["time_index"] \
                    and sa["day_of_week"] == sb["day_of_week"]:
                return True
            if (sa["day_of_week"] == sb["day_of_week"]
                    and sa["start_time"] < sb["end_time"]
                    and sa["end_time"] > sb["start_time"]):
                return True
    return False
