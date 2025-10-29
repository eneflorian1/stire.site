from fastapi import APIRouter, Depends
from sqlmodel import Session

from db import get_session
from deps import require_api_key
from models import Setting, GeminiKeyPayload


router = APIRouter()


@router.get("/settings/gemini-key")
def get_gemini_key(session: Session = Depends(get_session)) -> dict:
    setting = session.get(Setting, "gemini_api_key")
    return {"gemini_api_key": setting.value if setting else None}


@router.put("/settings/gemini-key", dependencies=[Depends(require_api_key)])
def set_gemini_key(payload: GeminiKeyPayload, session: Session = Depends(get_session)) -> dict:
    setting = session.get(Setting, "gemini_api_key")
    if not setting:
        setting = Setting(key="gemini_api_key", value=payload.gemini_api_key)
    else:
        setting.value = payload.gemini_api_key
        from datetime import datetime
        setting.updated_at = datetime.utcnow()
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return {"gemini_api_key": setting.value}


