# 🎓 CampusPeer

**Peer-to-Peer Timetable Match, FFCS Slot Exchange & Academic Social Hub**
Addressing **UN SDG 4 (Quality Education)** and **SDG 10 (Reduced Inequalities)**.

CampusPeer lets students paste their FFCS registration data, visualize a weekly
timetable grid, discover classmates in the same course/slot, follow peers
(Instagram-style), unlock mutual chat, and trade course slots through a
matching marketplace with atomic, ACID-safe swap execution.

## Architecture

```
database/schema.sql        Full PostgreSQL DDL: tables, CHECKs, composite PKs,
                           ON DELETE CASCADE, B+ tree indexes, overlap trigger,
                           security views, 2PL swap transaction template
app/                       FastAPI backend
  ├─ slot_data.py          FFCS slot-token master lookup (A1..G2/T*, L1–L60)
  ├─ grid_engine.py        Flat records → 2-tier Theory/Lab weekly matrix
  ├─ models.py             SQLAlchemy ORM (Postgres + SQLite compatible)
  ├─ routers/              auth · timetable · classmates · social · swap
parser/portal_parser.py    Clipboard text / HTML → clean relational records
app/static/            Glassmorphism lofi UI (vanilla HTML/CSS/JS): upload,
                       grid, classmates, chat, live slot-trading cards
```

## Quick start (dev — SQLite fallback, single server)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000      # API + docs at /docs
open http://localhost:8000                  # UI is served by the API
```

## Production (PostgreSQL)

```bash
export DATABASE_URL="postgresql+psycopg://user:pass@localhost/campuspeer"
pip install "psycopg[binary]"
psql -U user -d campuspeer -f database/schema.sql   # DDL incl. triggers/views
uvicorn app.main:app --port 8000
```

## API summary

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` `/login`, `GET /api/auth/me` | JWT auth (`@vitstudent.ac.in` only) |
| `POST /api/timetable/upload` | Parse pasted portal text, save enrollments (overlap-validated) |
| `GET /api/timetable/grid` | Structured 5-day theory/lab grid + free-cell count |
| `GET /api/classmates/find?course_code=&slot_token=` | Classmates per course/slot (contacts masked) |
| `POST /api/social/follow`, `GET /api/social/followers` | Follow/unfollow toggle, mutual detection |
| `POST /api/social/message`, `GET /api/social/messages/{id}` | Chat gated by mutual follow |
| `POST /api/swap/list`, `GET /api/swap/match`, `POST /api/swap/execute` | Listings, 1-to-1 + 3-way cycle matching, ACID swap |

## Key guarantees

- **Normalization:** BCNF/3NF schema; composite keys for mappings/enrollments.
- **Integrity:** DB trigger rejects overlapping enrollments; app-level check too.
- **Privacy:** `v_public_classmates` view and classmates endpoint mask roll
  numbers/emails; contact details unlock only after mutual follow.
- **Concurrency:** swap execution uses `SELECT … FOR UPDATE` row locks in one
  transaction — double claims return `409`.
