from __future__ import annotations

from dataclasses import dataclass
import os
import json
from urllib import request, error as urlerror, parse as urlparse
from datetime import datetime, timedelta
from threading import Event, Lock, Thread
from typing import Optional, Sequence, Any, cast

from sqlmodel import Session, select
from sqlalchemy import desc, func

from db import engine
from models import Setting, AutoposterLog, Topic, TopicStatus, Article, Category
from .logging import safe_log
from . import sources
from . import images
from . import gemini
from . import utils


@dataclass
class Status:
    """Snapshot al stării curente a procesului Autoposter."""
    running: bool
    started_at: Optional[datetime]
    items_created: int
    last_error: Optional[str]
    current_topic: Optional[str]


class Autoposter:
    """Worker thread‑safe care rulează în background, parcurge `Topic`‑uri din baza de date
    și creează `Article`‑uri folosind Gemini. Gestionează stare, loguri și oprire grațioasă.
    """
    def __init__(self) -> None:
        """Initializează starea internă, sincronizarea și configurarea rate‑limitului."""
        self._lock = Lock()
        self._running = False
        self._started_at: Optional[datetime] = None
        self._items_created = 0
        self._last_error: Optional[str] = None
        self._current_topic: Optional[str] = None
        self._thread: Optional[Thread] = None
        self._stop_event = Event()
        # Flag explicit pentru manual stop care persistă în memorie
        self._manual_stopped = False
        # Delay (seconds) between topic processing steps to respect provider rate limits
        try:
            self._delay_seconds = max(1, int(os.environ.get("AUTOPOSTER_DELAY_SECONDS", "12")))
        except Exception:
            self._delay_seconds = 12

    def _wait_with_stop(self, total_seconds: float) -> bool:
        """Returnează True dacă s-a oprit, False dacă a expirat timeout-ul."""
        remaining = float(total_seconds)
        step = 0.2
        while remaining > 0 and not self._stop_event.is_set():
            wait_time = min(step, remaining)
            if self._stop_event.wait(timeout=wait_time):
                return True
            remaining -= wait_time
        return self._stop_event.is_set()

    def init(self) -> None:
        """Punct de extensie pentru inițializări viitoare. În prezent nu face nimic."""
        pass

    def _get_gemini_key(self) -> Optional[str]:
        """Returnează cheia API Gemini din tabela `Setting` ('gemini_api_key') sau None."""
        with Session(engine) as session:
            row = session.get(Setting, "gemini_api_key")
            return row.value if row else None

    def _is_manual_stopped(self) -> bool:
        """Verifică atât flag-ul în memorie cât și cel din DB."""
        if self._manual_stopped:
            return True
        try:
            with Session(engine) as session:
                setting = session.get(Setting, "autoposter_manual_stop")
                return setting is not None and setting.value == "true"
        except Exception:
            return False

    # Backward-compat: keep the image download helper available on the instance
    def _download_image_to_uploads(self, url: str, name_hint: str) -> Optional[str]:
        return images.download_image_to_uploads(url, name_hint=name_hint)

    def start(self) -> None:
        """Pornește thread‑ul Autoposter cu verificări îmbunătățite."""
        with self._lock:
            if self._running:
                return
            # În cazul unui start manual, ridică flag-ul de oprire manuală
            self._manual_stopped = False
            # Verifică dacă a fost oprit manual în DB (cross-instance safety)
            if self._is_manual_stopped():
                self._last_error = "Autoposter oprit manual - apasă Start pentru a reporni"
                return
            key = self._get_gemini_key()
            if not key:
                self._last_error = "Missing Gemini API key"
                return
            self._running = True
            self._started_at = datetime.utcnow()
            self._last_error = None
            self._stop_event.clear()
            self._thread = Thread(target=self._run, name="autoposter", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """Oprire forțată cu timeout scurt și flag explicit."""
        with self._lock:
            if not self._running:
                return
            self._manual_stopped = True
            self._stop_event.set()
            t = self._thread
            self._thread = None
            self._running = False
            self._current_topic = None
        if t is not None:
            t.join(timeout=3.0)

    def reset(self) -> None:
        """Resetează contoarele volatile: `items_created` și `last_error`."""
        with self._lock:
            self._items_created = 0
            self._last_error = None

    def status(self) -> Status:
        """Returnează o fotografie thread‑safe a stării curente sub forma `Status`."""
        with self._lock:
            return Status(
                running=self._running,
                started_at=self._started_at,
                items_created=self._items_created,
                last_error=self._last_error,
                current_topic=self._current_topic,
            )

    def _run(self) -> None:
        """Bucla principală a jobului."""
        try:
            with Session(engine) as session:
                safe_log(session, "info", "🚀 Autoposter pornit")

            while not self._stop_event.is_set():
                if self._is_manual_stopped():
                    with Session(engine) as session:
                        safe_log(session, "info", "⏹️ Autoposter oprit manual")
                    break

                topics: list[Topic] = []
                with Session(engine) as session:
                    now = datetime.utcnow()
                    all_topics = list(
                        session.exec(
                            select(Topic).order_by(desc(cast(Any, Topic.created_at)))
                        ).all()
                    )
                    topics = [
                        t for t in all_topics
                        if (
                            t.imported_from is None
                            or t.imported_from != "google_trends"
                            or (
                                t.imported_from == "google_trends"
                                and (t.expires_at is None or t.expires_at >= now)
                            )
                        )
                    ]

                if not topics:
                    with self._lock:
                        self._current_topic = "Idle"
                    if self._wait_with_stop(10.0):
                        break
                    continue

                processed = 0
                posted = 0
                skipped = 0
                failed = 0

                for t in topics:
                    if self._stop_event.is_set() or self._is_manual_stopped():
                        break
                    processed += 1
                    with self._lock:
                        self._current_topic = t.name
                    now = datetime.utcnow()

                    with Session(engine) as session:
                        window_start = now - timedelta(hours=24)
                        existing_article = session.exec(
                            select(Article.id).where(
                                Article.source == "Autoposter",
                                Article.published_at >= window_start
                            ).where(
                                func.lower(Article.title).contains(t.name.lower())
                            ).limit(1)
                        ).first()
                        if existing_article:
                            skipped += 1
                            safe_log(session, "info", f"⏭️ Skip: '{t.name}' (postat recent)")
                            continue

                    if self._stop_event.is_set() or self._is_manual_stopped():
                        break

                    if self._wait_with_stop(self._delay_seconds):
                        break

                    if self._stop_event.is_set() or self._is_manual_stopped():
                        break

                    posted_ok = False
                    with Session(engine) as session:
                        existing_categories = session.exec(select(Category.name)).all()
                        title, predicted_category, content, hashtags = (t.name, None, None, None)
                        api_key = self._get_gemini_key()

                        # Căutare surse
                        src_list: list[dict[str, str]] = []
                        try:
                            src_list = sources.fetch_news_sources(t.name, max_results=3)
                            if src_list:
                                safe_log(session, "info", f"📰 '{t.name}': {len(src_list)} surse găsite")
                        except Exception:
                            safe_log(session, "warning", f"⚠️ '{t.name}': căutare surse eșuată")

                        # Extragere imagine principală
                        main_image_url: Optional[str] = None
                        try:
                            image_candidates = images.search_images(
                                t.name, max_results=5, wait_callback=self._wait_with_stop
                            )
                            if image_candidates:
                                main_image_url = image_candidates[0]
                                safe_log(session, "info", f"🖼️ '{t.name}': imagine găsită prin căutare ({len(image_candidates)} opțiuni)")
                                if not images.validate_image_url(main_image_url):
                                    if len(image_candidates) > 1:
                                        main_image_url = image_candidates[1]
                                        safe_log(session, "info", f"🖼️ '{t.name}': folosind a doua imagine (prima invalidă)")
                                    else:
                                        main_image_url = None
                                        safe_log(session, "warning", f"⚠️ '{t.name}': prima imagine invalidă, nu există alternativă")
                            else:
                                safe_log(session, "info", f"⚠️ '{t.name}': nu s-a găsit imagine prin căutare")
                        except Exception as img_err:  # noqa: F841
                            safe_log(session, "warning", f"⚠️ '{t.name}': căutare imagini eșuată")

                        # Fallback: surse
                        if not main_image_url and src_list:
                            try:
                                main_image_url = images.extract_main_image_from_sources(src_list)
                                if main_image_url:
                                    safe_log(session, "info", f"🖼️ '{t.name}': imagine găsită în sursele de știri")
                            except Exception:
                                safe_log(session, "warning", f"⚠️ '{t.name}': extragere imagine din surse eșuată")

                        if not main_image_url:
                            # placeholder SVG inline; frontend detectează
                            main_image_url = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+"

                        # Generare conținut
                        try:
                            if api_key and len(src_list) >= 1:
                                title, predicted_category, content, hashtags = gemini.call_gemini_from_sources(
                                    api_key, t.name, existing_categories, src_list
                                )
                            elif not src_list:
                                failed += 1
                                safe_log(session, "warning", f"⚠️ '{t.name}': fără surse disponibile")
                                continue
                        except Exception as gen_err:
                            failed += 1
                            safe_log(session, "error", f"❌ '{t.name}': eroare Gemini - {str(gen_err)[:80]}")
                            continue

                        mapped_category = utils.choose_category(predicted_category, session) or (existing_categories[0] if existing_categories else t.name)

                        # Download main image locally when possible for stable display
                        local_image_url: Optional[str] = None
                        attempted_sources = False
                        if main_image_url and images.validate_image_url(main_image_url):
                            local_image_url = images.download_image_to_uploads(main_image_url, name_hint=t.name)
                            if local_image_url:
                                safe_log(session, "info", f"🖼️ '{t.name}': imagine descărcată local")
                            else:
                                safe_log(session, "warning", f"⚠️ '{t.name}': descărcare imagine din Google eșuată")
                                try:
                                    alt_from_sources = images.extract_main_image_from_sources(src_list) if src_list else None
                                    attempted_sources = True
                                    if alt_from_sources and images.validate_image_url(alt_from_sources):
                                        local_image_url = images.download_image_to_uploads(alt_from_sources, name_hint=t.name)
                                        if local_image_url:
                                            safe_log(session, "info", f"🖼️ '{t.name}': imagine descărcată local din surse")
                                except Exception:
                                    pass
                        elif not main_image_url and src_list:
                            try:
                                alt_from_sources = images.extract_main_image_from_sources(src_list)
                                attempted_sources = True
                                if alt_from_sources and images.validate_image_url(alt_from_sources):
                                    local_image_url = images.download_image_to_uploads(alt_from_sources, name_hint=t.name)
                                    if local_image_url:
                                        safe_log(session, "info", f"🖼️ '{t.name}': imagine descărcată local din surse")
                                    else:
                                        main_image_url = alt_from_sources
                            except Exception:
                                pass

                        final_image_url = local_image_url or ""
                        if not final_image_url:
                            final_image_url = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+"

                        if content and content.strip():
                            article = Article(
                                title=title[:120],
                                summary=(content),
                                image_url=final_image_url,
                                source="Autoposter",
                                category=mapped_category,
                                published_at=now,
                                hashtags=utils.normalize_hashtags(hashtags),
                            )
                            session.add(article)

                            st = session.get(TopicStatus, t.id)
                            if not st:
                                st = TopicStatus(topic_id=t.id)
                            st.last_posted_at = now
                            st.last_result = "posted"
                            st.last_error = None
                            st.updated_at = now
                            session.add(st)
                            session.commit()
                            posted_ok = True
                            posted += 1
                            safe_log(session, "info", f"✅ '{t.name}' → '{title[:50]}...' [{mapped_category}]")
                        else:
                            failed += 1
                            st = session.get(TopicStatus, t.id)
                            if not st:
                                st = TopicStatus(topic_id=t.id)
                            st.last_posted_at = now
                            st.last_result = "error"
                            st.last_error = "Conținut indisponibil"
                            st.updated_at = now
                            session.add(st)
                            session.commit()
                            safe_log(session, "warning", f"⚠️ '{t.name}': conținut gol, nu s-a postat")

                    if posted_ok:
                        with self._lock:
                            self._items_created += 1
                            self._last_error = None

                with self._lock:
                    self._current_topic = "Idle"
                with Session(engine) as session:
                    safe_log(session, "info", f"🔄 Ciclu finalizat: {posted} postate | {skipped} skip | {failed} eșuate din {processed} topicuri")

                if self._stop_event.is_set() or self._is_manual_stopped():
                    break
                if self._wait_with_stop(5.0):
                    break

        except Exception as exc:
            with Session(engine) as session:
                safe_log(session, "error", f"💥 Eroare critică: {str(exc)[:150]}")
            with self._lock:
                self._last_error = str(exc)
                self._running = False
        finally:
            with self._lock:
                self._running = False
                self._current_topic = None
            with Session(engine) as session:
                safe_log(session, "info", "⏹️ Autoposter oprit complet")


