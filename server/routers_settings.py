from typing import Optional
import json

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
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


@router.get("/settings/google-service-account")
def get_google_service_account(session: Session = Depends(get_session)) -> dict:
    """Returnează statusul Google Service Account (doar dacă există, fără a expune conținutul)."""
    setting = session.get(Setting, "google_service_account_json")
    return {
        "exists": setting is not None and setting.value is not None,
        "has_content": bool(setting and setting.value and len(setting.value) > 0)
    }


@router.post("/settings/google-service-account")
def upload_google_service_account(
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> dict:
    """
    Încarcă fișierul JSON cu credențialele Google Service Account.
    
    - Prima configurare nu cere cheie de autentificare.
    - Ulterioarele actualizări sunt protejate de `x-api-key`.
    """
    setting = session.get(Setting, "google_service_account_json")
    
    # Dacă există deja un fișier salvat, cerem autentificare
    if setting is not None:
        expected_keys = _resolve_expected_api_keys(session)
        if expected_keys and (not x_api_key or x_api_key not in expected_keys):
            raise HTTPException(status_code=401, detail="Invalid or missing API key")
    
    # Verifică tipul fișierului
    if not file.filename or not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Fișierul trebuie să fie de tip JSON (.json)")
    
    try:
        # Citește conținutul fișierului
        content = file.file.read()
        json_content = content.decode('utf-8')
        
        # Validează că este JSON valid
        try:
            json_data = json.loads(json_content)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Fișierul JSON nu este valid: {str(e)}")
        
        # Salvează în baza de date
        if not setting:
            setting = Setting(key="google_service_account_json", value=json_content)
        else:
            setting.value = json_content
            from datetime import datetime
            setting.updated_at = datetime.utcnow()
        
        session.add(setting)
        session.commit()
        session.refresh(setting)
        
        return {
            "success": True,
            "message": "Fișierul Google Service Account a fost încărcat cu succes",
            "exists": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la încărcarea fișierului: {str(e)}")


