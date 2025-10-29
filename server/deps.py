from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from config import API_KEY
from db import get_session
from models import Setting


def _resolve_expected_api_key(session: Session) -> Optional[str]:
    setting = session.get(Setting, "gemini_api_key")
    if setting and setting.value:
        value = setting.value.strip()
        if value:
            return value
    return API_KEY or None


def require_api_key(
    x_api_key: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> None:
    expected_key = _resolve_expected_api_key(session)
    if expected_key and x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


