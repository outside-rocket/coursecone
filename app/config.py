import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./coursecone.db",  # dev fallback; use postgresql+psycopg://user:pass@host/coursecone
)
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "1440"))
