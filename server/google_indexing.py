"""
Google Indexing API module pentru submit automat de URL-uri către Google Search Console.

Utilizare:
    from google_indexing import submit_url_to_google
    
    # După ce ai salvat un articol
    article_url = build_article_url(article, base_url="https://stire.site")
    submit_url_to_google(article_url)
"""

import os
import json
import logging
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Calea către fișierul JSON cu credențialele service account (fallback)
# Poate fi setată prin variabila de mediu GOOGLE_SERVICE_ACCOUNT_FILE
SERVICE_ACCOUNT_FILE = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_FILE",
    os.path.join(os.path.dirname(__file__), "google_service_account.json")
)

# Scopul necesar pentru Google Indexing API
SCOPES = ["https://www.googleapis.com/auth/indexing"]

# Cache pentru client-ul Google API (se inițializează o singură dată)
_indexing_service: Optional[object] = None


def _get_credentials_from_db():
    """Obține credențialele Google din baza de date."""
    try:
        from db import engine
        from models import Setting
        from sqlmodel import Session
        
        with Session(engine) as session:
            setting = session.get(Setting, "google_service_account_json")
            if setting and setting.value:
                return json.loads(setting.value)
        return None
    except Exception as e:
        logger.error(f"Eroare la citirea credențialelor din baza de date: {e}")
        return None


def _get_credentials_from_file():
    """Obține credențialele Google din fișier (fallback pentru compatibilitate)."""
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        try:
            with open(SERVICE_ACCOUNT_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Eroare la citirea fișierului de credențiale: {e}")
    return None


def _get_indexing_service():
    """Obține sau creează client-ul Google Indexing API."""
    global _indexing_service
    
    if _indexing_service is not None:
        return _indexing_service
    
    # Încearcă să obțină credențialele din baza de date (prioritate)
    credentials_data = _get_credentials_from_db()
    
    # Dacă nu există în baza de date, încearcă din fișier (fallback)
    if not credentials_data:
        credentials_data = _get_credentials_from_file()
        if credentials_data:
            logger.info("Credențialele Google au fost încărcate din fișier (fallback)")
    
    if not credentials_data:
        logger.warning(
            "Credențialele Google nu au fost găsite nici în baza de date, nici în fișier. "
            "Google Indexing API va fi dezactivat. "
            "Încarcă fișierul JSON în admin dashboard sau plasează fișierul JSON în server/."
        )
        return None
    
    try:
        # Creează credențialele din JSON
        # Google API acceptă atât service account cât și OAuth client credentials
        if credentials_data.get("type") == "service_account":
            # Service account format
            credentials = service_account.Credentials.from_service_account_info(
                credentials_data,
                scopes=SCOPES
            )
        else:
            # OAuth client format - pentru Indexing API avem nevoie de service account
            # Dacă este OAuth client, încercăm să folosim direct info-ul
            logger.warning(
                "Formatul credențialelor pare să fie OAuth client, nu service account. "
                "Google Indexing API necesită service account. "
                "Verifică că ai un service account JSON valid."
            )
            # Încercăm totuși să creăm credențialele
            # Pentru OAuth client, ar trebui să folosim flow diferit, dar pentru Indexing API
            # avem nevoie de service account
            return None
        
        # Construiește serviciul Google Indexing API
        _indexing_service = build("indexing", "v3", credentials=credentials)
        logger.info("Google Indexing API client inițializat cu succes")
        return _indexing_service
    except Exception as e:
        logger.error(f"Eroare la inițializarea Google Indexing API: {e}")
        import traceback
        logger.debug(traceback.format_exc())
        return None


def submit_url_to_google(url: str, action: str = "URL_UPDATED") -> bool:
    """
    Trimite un URL către Google Indexing API pentru indexare.
    
    Args:
        url: URL-ul complet al articolului (ex: https://stire.site/tech/articol/15-01-2024/titlu-articol)
        action: Tipul de acțiune - "URL_UPDATED" (default) sau "URL_DELETED"
    
    Returns:
        True dacă submit-ul a reușit, False altfel
    """
    service = _get_indexing_service()
    
    if service is None:
        # Serviciul nu este disponibil (lipsește fișierul de credențiale)
        return False
    
    try:
        # Construiește body-ul request-ului
        body = {
            "url": url,
            "type": action
        }
        
        # Trimite request-ul către Google Indexing API
        request = service.urlNotifications().publish(body=body)
        response = request.execute()
        
        logger.info(f"URL trimis cu succes către Google: {url}")
        logger.debug(f"Răspuns Google: {response}")
        return True
        
    except HttpError as e:
        # Erori HTTP de la Google API
        error_details = e.error_details if hasattr(e, 'error_details') else str(e)
        logger.error(f"Eroare HTTP la submit URL către Google: {error_details}")
        return False
        
    except Exception as e:
        # Alte erori
        logger.error(f"Eroare neașteptată la submit URL către Google: {e}")
        return False


def build_article_url(article, base_url: str) -> str:
    """
    Construiește URL-ul SEO-friendly pentru un articol.
    
    Args:
        article: Obiect Article cu atributele title, category, published_at
        base_url: URL-ul de bază al site-ului (ex: "https://stire.site")
    
    Returns:
        URL-ul complet al articolului
    """
    import re
    import unicodedata
    from datetime import datetime
    
    def _slugify(title: str) -> str:
        """Generează slug din titlu (același algoritm ca în routers_articles.py)"""
        value = unicodedata.normalize("NFKD", title)
        value = "".join(ch for ch in value if not unicodedata.combining(ch))
        value = value.lower()
        value = re.sub(r"[^a-z0-9\s-]", "", value)
        value = re.sub(r"[\s_-]+", "-", value).strip("-")
        return value[:120]
    
    slug = _slugify(article.title)
    date_str = article.published_at.strftime("%d-%m-%Y") if article.published_at else ""
    category = article.category or "stiri"
    cat_slug = _slugify(category)
    
    return f"{base_url.rstrip('/')}/{cat_slug}/articol/{date_str}/{slug}"

