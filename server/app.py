import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy import text
from sqlmodel import Session, SQLModel, select
from starlette.staticfiles import StaticFiles

import models  # ensure models are imported for SQLModel metadata
# Lazy import autoposter at startup to avoid partial import issues
autoposter_manager = None
from config import FLUTTER_WEB_DIR, UPLOAD_DIR
from db import engine
from models import Article, Category, Setting

from routers_admin import router as admin_router
from routers_announcements import router as announcements_router
from routers_articles import router as articles_router
from routers_autoposter import router as autoposter_router
from routers_categories import router as categories_router
from routers_settings import router as settings_router
from routers_sitemap import router as sitemap_router
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

# Serve uploaded images (downloaded by autoposter) at /uploads
try:
    if not os.path.isdir(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
except Exception as _:
    # Non-fatal if directory cannot be created at startup; can be created later
    pass

@app.on_event("startup")
def on_startup() -> None:
    # Only create tables if they don't exist
    # Check if any tables exist first
    with engine.connect() as conn:
        if engine.url.get_backend_name() == "sqlite":
            # Check if database has any tables
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
            existing_tables = [row[0] for row in result.fetchall()]
            if not existing_tables:
                # No tables exist, create them
                SQLModel.metadata.create_all(engine)
            else:
                # Tables exist, just ensure all models are registered
                # This is safe and won't recreate existing tables
                try:
                    SQLModel.metadata.create_all(engine, checkfirst=True)
                except Exception:
                    # If create_all fails, tables likely already exist - this is fine
                    pass
        else:
            # For non-SQLite databases, use checkfirst
            SQLModel.metadata.create_all(engine, checkfirst=True)
    # Lightweight migration for new columns when using SQLite
    try:
        with engine.connect() as conn:
            if engine.url.get_backend_name() == "sqlite":
                rows = conn.execute(text("PRAGMA table_info(article)")).fetchall()
                cols = {r[1] for r in rows}
                if "hashtags" not in cols:
                    conn.execute(text("ALTER TABLE article ADD COLUMN hashtags TEXT"))
                # Migrations for Topic new columns
                rows_t = conn.execute(text("PRAGMA table_info(topic)")).fetchall()
                cols_t = {r[1] for r in rows_t}
                if "imported_from" not in cols_t:
                    conn.execute(text("ALTER TABLE topic ADD COLUMN imported_from TEXT"))
                if "expires_at" not in cols_t:
                    conn.execute(text("ALTER TABLE topic ADD COLUMN expires_at TIMESTAMP"))
                # Migration for Announcement use_animated_banner column
                rows_a = conn.execute(text("PRAGMA table_info(announcement)")).fetchall()
                cols_a = {r[1] for r in rows_a}
                if "use_animated_banner" not in cols_a:
                    conn.execute(text("ALTER TABLE announcement ADD COLUMN use_animated_banner BOOLEAN DEFAULT 0"))
                    conn.commit()
    except Exception as e:
        # Non-fatal: continue startup even if migration fails
        print(f"[startup] Hashtags column migration skipped: {e}")
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
    # Start trends scheduler (daily)
    try:
        from threading import Thread, Event
        from datetime import timedelta, datetime as _dt
        from trends import import_google_trends, purge_expired_trends

        stop_event = Event()

        def _scheduler() -> None:
            # Rulează imediat la startup, apoi la fiecare 24h
            while not stop_event.is_set():
                try:
                    removed = purge_expired_trends()
                    stats = import_google_trends(country="RO")
                    # După import, încearcă să pornească autoposterul doar dacă nu a fost oprit manual
                    global autoposter_manager
                    if autoposter_manager is not None:
                        try:
                            # Verifică dacă utilizatorul a oprit manual autoposterul
                            with Session(engine) as check_session:
                                manual_stop_setting = check_session.get(Setting, "autoposter_manual_stop")
                                manual_stop = manual_stop_setting and manual_stop_setting.value == "true"
                            
                            # pornește doar dacă nu rulează deja ȘI nu a fost oprit manual
                            st = autoposter_manager.status()
                            if not st.running and not manual_stop:
                                autoposter_manager.reset()
                                autoposter_manager.start()
                        except Exception as _:
                            pass
                except Exception as _:
                    pass
                # Așteaptă 24h
                for _ in range(24 * 60):
                    if stop_event.is_set():
                        break
                    stop_event.wait(timeout=60)

        th = Thread(target=_scheduler, name="trends-scheduler", daemon=True)
        th.start()
    except Exception as e:  # noqa: BLE001
        print(f"[startup] Trends scheduler failed: {e}")


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
app.include_router(sitemap_router)


