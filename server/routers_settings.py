from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session

from db import get_session
from deps import require_api_key, _resolve_expected_api_keys
from models import Setting, GeminiKeyPayload


router = APIRouter()


@router.get("/settings/gemini-key")
def get_gemini_key(session: Session = Depends(get_session)) -> dict:
    setting = session.get(Setting, "gemini_api_key")
    return {"gemini_api_key": setting.value if setting else None}


@router.put("/settings/gemini-key")
def set_gemini_key(
    payload: GeminiKeyPayload,
    x_api_key: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> dict:
    """
    Salvează cheia Gemini.

    - Prima configurare (când nu există încă `gemini_api_key` în DB) nu cere cheie de autentificare,
      pentru a evita blocarea inițială dacă `API_KEY` din env diferă între local și producție.
    - Ulterioarele actualizări sunt protejate de `x-api-key` și acceptă atât cheia Gemini curentă,
      cât și `API_KEY` din environment (prin `_resolve_expected_api_keys`).
    """
    setting = session.get(Setting, "gemini_api_key")

    # Dacă există deja o cheie salvată, cerem autentificare
    if setting is not None:
        expected_keys = _resolve_expected_api_keys(session)
        if expected_keys and (not x_api_key or x_api_key not in expected_keys):
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

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


