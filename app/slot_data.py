"""FFCS slot-token -> (day, start, end) master lookup.

Theory grid: 5 morning periods (08:00-12:50) + lunch 12:50-14:00 +
5 afternoon/evening periods (14:00-19:50). Lab grid: L1..L60 as
continuous 50-minute blocks (12 per day across 5 days).
"""
from datetime import time

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
LUNCH = (time(12, 50), time(14, 0))

THEORY_ROWS = [
    # (start, end, [tokens MON..FRI])
    (time(8, 0),  time(8, 50),  ["A1", "B1", "C1", "D1", "E1"]),
    (time(9, 0),  time(9, 50),  ["F1", "G1", "TAA1", "TBB1", "TCC1"]),
    (time(10, 0), time(10, 50), ["TA1", "TB1", "TC1", "TD1", "TE1"]),
    (time(11, 0), time(11, 50), ["A2", "B2", "C2", "D2", "E2"]),
    (time(12, 0), time(12, 50), ["TF1", "TG1", "TDD1", "TEE1", "TFF1"]),
    (time(14, 0), time(14, 50), ["F2", "G2", "TFF2", "TGG2", "TAA2"]),
    (time(15, 0), time(15, 50), ["TF2", "TG2", "TBB2", "TCC2", "TDD2"]),
    (time(16, 0), time(16, 50), ["TEA2", "TEB2", "TEE2", "TAA1X", "TEC2"]),
    (time(17, 0), time(17, 50), ["TEA1", "TEB1", "TEC1", "TED1", "TED2"]),
    (time(18, 0), time(19, 50), ["E1", "E2", "ELA1", "ELA2", "ELB1"]),
]

SLOT_DEFINITIONS: dict[str, dict] = {}

for start, end, tokens in THEORY_ROWS:
    for day, token in zip(DAYS, tokens):
        SLOT_DEFINITIONS[token] = {
            "slot_token": token, "slot_type": "THEORY",
            "day_of_week": day, "start_time": start, "end_time": end,
        }

# Labs: L1..L60 -> day = (n-1)//12, period = (n-1) % 12,
# 50-minute blocks on a 60-minute pitch: 08:00 through 19:50 per day
for n in range(1, 61):
    day = DAYS[(n - 1) // 12]
    idx = (n - 1) % 12
    start_min = 8 * 60 + idx * 60
    end_min = start_min + 50
    start = time(start_min // 60, start_min % 60)
    end = time(end_min // 60, end_min % 60)
    SLOT_DEFINITIONS[f"L{n}"] = {
        "slot_token": f"L{n}", "slot_type": "LAB",
        "day_of_week": day, "start_time": start, "end_time": end,
    }


def get_slot(token: str) -> dict | None:
    return SLOT_DEFINITIONS.get(token.strip().upper())


def slots_overlap(tokens_a: list[str], tokens_b: list[str]) -> bool:
    """True if any pair of slot tokens overlaps in day+time."""
    a = [get_slot(t) for t in tokens_a]
    b = [get_slot(t) for t in tokens_b]
    for sa in filter(None, a):
        for sb in filter(None, b):
            if (sa["day_of_week"] == sb["day_of_week"]
                    and sa["start_time"] < sb["end_time"]
                    and sa["end_time"] > sb["start_time"]):
                return True
    return False
