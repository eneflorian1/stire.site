from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from threading import Event, Lock, Thread
from typing import Optional

from sqlmodel import Session, select

from db import engine
from models import Setting, AutoposterLog


@dataclass
class Status:
    running: bool
    started_at: Optional[datetime]
    items_created: int
    last_error: Optional[str]
    current_topic: Optional[str]


class Autoposter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._running = False
        self._started_at: Optional[datetime] = None
        self._items_created = 0
        self._last_error: Optional[str] = None
        self._current_topic: Optional[str] = None
        self._thread: Optional[Thread] = None
        self._stop_event = Event()

    def init(self) -> None:
        # No-op placeholder for future initialization
        pass

    def _get_gemini_key(self) -> Optional[str]:
        with Session(engine) as session:
            row = session.get(Setting, "gemini_api_key")
            return row.value if row else None

    def start(self) -> None:
        with self._lock:
            if self._running:
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
        with self._lock:
            if not self._running:
                return
            self._stop_event.set()
            t = self._thread
            self._thread = None
            self._running = False
            self._current_topic = None
        if t is not None:
            t.join(timeout=2)

    def reset(self) -> None:
        with self._lock:
            self._items_created = 0
            self._last_error = None

    def status(self) -> Status:
        with self._lock:
            return Status(
                running=self._running,
                started_at=self._started_at,
                items_created=self._items_created,
                last_error=self._last_error,
                current_topic=self._current_topic,
            )

    def _run(self) -> None:
        # Minimal placeholder loop; integrate real posting logic later
        try:
            while not self._stop_event.is_set():
                self._stop_event.wait(timeout=1.0)
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self._last_error = str(exc)
                self._running = False


def safe_log(session: Session, level: str, message: str) -> None:
    row = AutoposterLog(level=level.upper(), message=message)
    session.add(row)
    session.commit()


# Singleton instance imported by the API routers
autoposter = Autoposter()


