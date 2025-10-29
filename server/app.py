import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlmodel import Session, SQLModel, select
from starlette.staticfiles import StaticFiles

import models  # ensure models are imported for SQLModel metadata
# Lazy import autoposter at startup to avoid partial import issues
autoposter_manager = None
from config import FLUTTER_WEB_DIR
from db import engine
from models import Article, Category

from routers_admin import router as admin_router
from routers_announcements import router as announcements_router
from routers_articles import router as articles_router
from routers_autoposter import router as autoposter_router
from routers_categories import router as categories_router
from routers_settings import router as settings_router
from routers_topics import router as topics_router


app = FastAPI(title="Stirix API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev-friendly; tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Serve Flutter web (mobile UI) if built at app/build/web -> mounted at /mobile
if os.path.isdir(FLUTTER_WEB_DIR):
    app.mount("/mobile", StaticFiles(directory=FLUTTER_WEB_DIR, html=True), name="mobile")


@app.on_event("startup")
def on_startup() -> None:
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # seed categories from existing article categories if category table empty
        count_categories = session.exec(select(func.count(Category.id))).one()
        if count_categories == 0:
            cats = session.exec(select(Article.category).distinct()).all()
            for c in cats:
                if c:
                    session.add(Category(name=c))
            session.commit()
    # Initialize autoposter manager (stopped by default)
    global autoposter_manager
    if autoposter_manager is None:
        try:
            from autoposter import autoposter as _autoposter
            autoposter_manager = _autoposter
        except Exception as e:  # noqa: BLE001
            # Degrade gracefully; API can still function without autoposter
            print(f"[startup] Autoposter import failed: {e}")
            autoposter_manager = None
    if autoposter_manager is not None:
        try:
            autoposter_manager.init()
        except Exception as e:  # noqa: BLE001
            print(f"[startup] Autoposter init failed: {e}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Include routers (paths preserved)
app.include_router(categories_router)
app.include_router(articles_router)
app.include_router(admin_router)
app.include_router(topics_router)
app.include_router(announcements_router)
app.include_router(settings_router)
app.include_router(autoposter_router)


