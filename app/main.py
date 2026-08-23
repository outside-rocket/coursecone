from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth, classmates, social, swap, timetable
from .slot_data import SLOT_DEFINITIONS

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CampusPeer", version="1.0.0",
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
