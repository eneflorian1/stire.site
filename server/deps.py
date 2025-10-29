from typing import Optional, Sequence

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from config import API_KEY
from db import get_session
from models import Setting


def _resolve_expected_api_keys(session: Session) -> Sequence[str]:
    keys: list[str] = []

    # Only use the environment API_KEY for admin authentication
    # Gemini API key is separate and only used for autoposter functionality
    if API_KEY:
        env_value = API_KEY.strip()
        if env_value:
            keys.append(env_value)

    return keys


def require_api_key(
    x_api_key: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> None:
    expected_keys = _resolve_expected_api_keys(session)
    if expected_keys and (not x_api_key or x_api_key not in expected_keys):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


