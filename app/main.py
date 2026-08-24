from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth, classmates, social, swap, timetable
from .slot_data import SLOT_DEFINITIONS

Base.metadata.create_all(bind=engine)

# lightweight dev migration: add slot_string if the table predates it
with engine.connect() as _conn:
    from sqlalchemy import text as _text
    cols = [r[1] for r in _conn.execute(_text("PRAGMA table_info(class_offering)"))]
    if cols and "slot_string" not in cols:
        _conn.execute(_text("ALTER TABLE class_offering ADD COLUMN slot_string VARCHAR(60)"))
        _conn.commit()
    fcols = [r[1] for r in _conn.execute(_text("PRAGMA table_info(user_follows)"))]
    if fcols and "status" not in fcols:
        _conn.execute(_text("ALTER TABLE user_follows ADD COLUMN status VARCHAR(10) DEFAULT 'PENDING' NOT NULL"))
        _conn.commit()
    ecols = [r[1] for r in _conn.execute(_text("PRAGMA table_info(enrollment)"))]
    if ecols and "slot_tokens" not in ecols:
        _conn.execute(_text("ALTER TABLE enrollment ADD COLUMN slot_tokens VARCHAR(60)"))
        _conn.commit()
    scols = [r[1] for r in _conn.execute(_text("PRAGMA table_info(student)"))]
    for col, typ in (("phone", "VARCHAR(20)"), ("instagram", "VARCHAR(60)"), ("facebook", "VARCHAR(60)"),
                     ("linkedin", "VARCHAR(80)"), ("reddit", "VARCHAR(60)"), ("dob", "VARCHAR(10)")):
        if scols and col not in scols:
            _conn.execute(_text(f"ALTER TABLE student ADD COLUMN {col} {typ}"))
    _conn.commit()

app = FastAPI(title="CourseConE", version="1.0.0",
              description="P2P Timetable Match, FFCS Slot Exchange & Academic Social Hub")

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(timetable.router)
app.include_router(classmates.router)
app.include_router(social.router)
app.include_router(swap.router)


@app.get("/")
def index():
    return FileResponse("app/static/index.html")


app.mount("/static", StaticFiles(directory="app/static"), name="static")
