<div align="center">

# ◮ CourseConE

### Academic Intelligence & Slot Trading Hub

**Peer-to-Peer Timetable Matching · FFCS Slot Exchange · Academic Social Network**

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.10%2B-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-ready-336791?logo=postgresql&logoColor=white) ![License](https://img.shields.io/badge/license-private-lightgrey)

Addressing **UN SDG 4** (Quality Education) &nbsp;·&nbsp; **SDG 10** (Reduced Inequalities)

</div>

---

## ✨ Features

> 📌 *This section is the single source of truth for shipped features — update it whenever a feature is added to the project.*

| | Feature | Description |
|---|---|---|
| 🪐 | **Planetary Home Orbit** | Spatial home screen with orbiting module nodes; scroll-dive transition dims the cosmos and rises the workspace |
| 📅 | **Timetable Matrix** | Paste raw FFCS registration text → parsed into a 5-day Theory/Lab weekly grid with hover "liquid glass" lens inspection |
| ➕ | **FFCS Ingestion** | State-machine + regex parser for VIT portal registration dumps, with slot-token master lookup (A1–G2 / T\* / L1–L60) |
| 👥 | **Classmate Radar** | Discover peers enrolled in the same course & slot; contacts masked until mutual follow |
| ⚡ | **Social Network** | Instagram-style follow requests, mutual detection, followers/following graph, in-app messaging gated by mutuality |
| 🔄 | **Timetable Compare** | Side-by-side overlap visualization — same class, both busy, only-me, only-them, both-free legend |
| ⇄ | **Slot Marketplace** | List enrolled slots for exchange; 1-to-1 matching plus 3-way cycle matching executed atomically |
| 🔐 | **ACID Swap Engine** | Stored procedure with strict Two-Phase Locking (`SELECT … FOR UPDATE`), conflict verification, guaranteed rollback |
| ⌘ | **Command Palette** | `Cmd/Ctrl+K` quick navigation to any view, course, or peer |
| 👤 | **Student Profile** | Identity, bio, DOB and social links (Instagram, LinkedIn, GitHub, etc.) |

## 🏗️ Architecture

```text
database/
├── schema.sql            Full DDL: PERSON EER superclass (Option 8A), weak-entity
│                         CLASS_OFFERING, 1NF slot breakdown, CHECK constraints,
│                         ON DELETE CASCADE, B+ tree indexes, security views,
│                         2PL swap stored procedure
└── er_diagram.md         Mermaid ER diagrams (full + simplified)

app/
├── main.py               FastAPI app — serves API + static UI from one port
├── config.py             Environment-driven settings
├── database.py           SQLAlchemy engine/session
├── models.py             ORM models (PostgreSQL + SQLite compatible)
├── security.py           bcrypt hashing + HS256 JWT issuance/verification
├── deps.py               Auth dependencies
├── grid_engine.py        Flat records → 2-tier Theory/Lab weekly matrix
├── swap_engine.py        Listing matching + swap orchestration
├── slot_data.py          FFCS slot-token master lookup
└── routers/
    ├── auth.py           Register / login / me
    ├── classmates.py     Peer discovery
    ├── social.py         Follows, requests, messages
    └── …                 Timetable & swap endpoints

parser.py                 Multi-line portal parser (state machine + regex blocks)
app/static/               Glassmorphism UI — vanilla HTML/CSS/JS, canvas black-hole
                          background, planetary navigation, command palette
tests/                    Test suite
```

## 🚀 Quick Start

### Development (SQLite fallback, single server)

```bash
git clone <repo-url> && cd coursecone
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open **http://localhost:8000** — the API docs are served at `/docs`.

### Production (PostgreSQL)

```bash
export DATABASE_URL="postgresql+psycopg://user:pass@localhost/coursecone"
pip install "psycopg[binary]"

psql -U user -d coursecone -f database/schema.sql   # DDL incl. views/procedure
uvicorn app.main:app --port 8000
```

## 🔌 API Summary

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` · `/login` · `GET /api/auth/me` | JWT auth (`@vitstudent.ac.in` only) |
| `POST /api/timetable/upload` | Parse pasted portal text, save enrollments (overlap-validated) |
| `GET /api/timetable/grid` | Structured 5-day theory/lab grid + free-cell count |
| `GET /api/classmates/find?course_code=&slot_token=` | Classmates per course/slot (contacts masked) |
| `POST /api/social/follow` · `GET /api/social/followers` | Follow/unfollow toggle, mutual detection |
| `POST /api/social/message` · `GET /api/social/messages/{id}` | Chat gated by mutual follow |
| `POST /api/swap/list` · `GET /api/swap/match` · `POST /api/swap/execute` | Listings, matching, ACID swap execution |

## 🛡️ Key Guarantees

- **Normalization** — BCNF/3NF schema; composite keys for mappings & enrollments.
- **Integrity** — DB trigger rejects overlapping enrollments; app-level check too.
- **Privacy** — Security views (`v_public_peers`) make `email`/`password_hash`
  structurally unreachable; contact details unlock only after mutual follow.
- **Concurrency** — Swap execution uses strict 2PL row locks inside one
  transaction; conflicting/double claims raise errors and roll back fully.

## 🧪 Testing

```bash
pytest tests/
python scripts/cleanup_demo_data.py   # reset demo data
```

---

<div align="center">
<sub>Built with FastAPI · SQLAlchemy · PostgreSQL · Vanilla JS — ▲ CourseConE</sub>
</div>
