from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from sqlalchemy import delete

from db import get_session
from deps import require_api_key
from models import AutoposterStatus, AutoposterLog
from fastapi import HTTPException


router = APIRouter()
def _get_autoposter():
    try:
        # Lazy import to avoid import-time failures
        from autoposter import autoposter  # type: ignore
        return autoposter
    except Exception as e:  # noqa: BLE001
        return None


def _safe_log(session: Session, level: str, message: str) -> None:
    try:
        # Try to use the real safe_log if available
        from autoposter import safe_log as real_safe_log  # type: ignore
        return real_safe_log(session, level, message)
    except Exception:
        # Minimal fallback logger
        row = AutoposterLog(level=level.upper(), message=message)
        session.add(row)
        session.commit()



@router.get("/autoposter/status")
def autoposter_status() -> dict:
    ap = _get_autoposter()
    if ap is None:
        raise HTTPException(status_code=503, detail="Autoposter indisponibil")
    st = ap.status()
    return {
        "running": st.running,
        "started_at": st.started_at.isoformat() + "Z" if st.started_at else None,
        "items_created": st.items_created,
        "last_error": st.last_error,
        "current_topic": st.current_topic,
    }


@router.get("/autoposter/logs")
def autoposter_logs(limit: int = 100, session: Session = Depends(get_session)) -> dict:
    rows = session.exec(select(AutoposterLog).order_by(AutoposterLog.ts.desc()).limit(limit)).all()
    return {
        "logs": [
            {"id": r.id, "ts": r.ts.isoformat() + "Z", "level": r.level, "message": r.message}
            for r in rows
        ]
    }


@router.post("/autoposter/start", dependencies=[Depends(require_api_key)])
def autoposter_start(session: Session = Depends(get_session)) -> dict:
    ap = _get_autoposter()
    if ap is None:
        raise HTTPException(status_code=503, detail="Autoposter indisponibil")
    _safe_log(session, "info", "Autoposter pornit")
    ap.start()
    st = ap.status()
    return {
        "running": st.running,
        "started_at": st.started_at.isoformat() + "Z" if st.started_at else None,
        "items_created": st.items_created,
        "last_error": st.last_error,
        "current_topic": st.current_topic,
    }


@router.post("/autoposter/stop", dependencies=[Depends(require_api_key)])
def autoposter_stop(session: Session = Depends(get_session)) -> dict:
    ap = _get_autoposter()
    if ap is None:
        raise HTTPException(status_code=503, detail="Autoposter indisponibil")
    ap.stop()
    _safe_log(session, "info", "Autoposter oprit")
    st = ap.status()
    return {
        "running": st.running,
        "started_at": st.started_at.isoformat() + "Z" if st.started_at else None,
        "items_created": st.items_created,
        "last_error": st.last_error,
        "current_topic": st.current_topic,
    }


@router.post("/autoposter/reset", dependencies=[Depends(require_api_key)])
def autoposter_reset(session: Session = Depends(get_session)) -> dict:
    # Reset in-memory counters/state
    ap = _get_autoposter()
    if ap is None:
        raise HTTPException(status_code=503, detail="Autoposter indisponibil")
    ap.reset()
    # Clear persisted logs
    session.exec(delete(AutoposterLog))
    session.commit()
    _safe_log(session, "info", "Autoposter resetat")
    st = ap.status()
    return {
        "running": st.running,
        "started_at": st.started_at.isoformat() + "Z" if st.started_at else None,
        "items_created": st.items_created,
        "last_error": st.last_error,
        "current_topic": st.current_topic,
    }


