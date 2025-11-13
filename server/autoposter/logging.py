from __future__ import annotations

from sqlmodel import Session

from models import AutoposterLog


def safe_log(session: Session, level: str, message: str) -> None:
    """Scrie un mesaj în `AutoposterLog` și confirmă tranzacția."""
    row = AutoposterLog(level=level.upper(), message=message)
    session.add(row)
    session.commit()


