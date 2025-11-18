import logging
from datetime import datetime
from typing import Optional

import requests

from models import Article

logger = logging.getLogger(__name__)


def _slugify(value: str) -> str:
    """
    Simplified slugify helper – keep it in sync with routers_sitemap/routers_articles.
    """
    import re
    import unicodedata

    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:120]


def build_article_url(base_url: str, article: Article) -> str:
    """
    Construiește URL-ul public al articolului, identic cu cel folosit în sitemap.
    """
    slug = _slugify(article.title)
    date_str = article.published_at.strftime("%d-%m-%Y") if isinstance(article.published_at, datetime) else ""
    category = article.category or "stiri"
    cat_slug = _slugify(category)
    return f"{base_url.rstrip('/')}/{cat_slug}/articol/{date_str}/{slug}"


def ping_sitemap(base_url: str) -> None:
    """
    Pingează sitemap-ul la Google (și Bing) după creare/actualizare articol.

    Nu aruncă excepții dacă request-ul eșuează – doar loghează un warning.
    """
    sitemap_url = f"{base_url.rstrip('/')}/sitemap.xml"
    endpoints = {
        "google": "https://www.google.com/ping",
        "bing": "https://www.bing.com/ping",
    }
    for name, endpoint in endpoints.items():
        try:
            resp = requests.get(endpoint, params={"sitemap": sitemap_url}, timeout=5)
            if resp.status_code != 200:
                logger.warning("Sitemap ping to %s returned status %s", name, resp.status_code)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sitemap ping to %s failed: %s", name, exc)


def notify_new_or_updated_article(article: Article, *, base_url: Optional[str]) -> None:
    """
    Wrapper apelat din endpointurile de creare/actualizare articole.

    - Construiește URL-ul articolului (pentru log).
    - Pingează sitemap-ul la motoarele de căutare.
    - Este tolerant la erori (nu trebuie să blocheze salvarea articolului).
    """
    if not base_url:
        # Dacă nu știm baza de URL, nu facem nimic – nu blocăm request-ul.
        logger.debug("notify_new_or_updated_article: missing base_url, skipping ping")
        return

    try:
        article_url = build_article_url(base_url, article)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to build article URL for indexing: %s", exc)
        article_url = None

    try:
        ping_sitemap(base_url)
        if article_url:
            logger.info("Search engines notified (via sitemap ping) for article: %s", article_url)
    except Exception as exc:  # noqa: BLE001
        # Nu lăsăm ca o eroare de rețea să rupă API-ul.
        logger.warning("Error while notifying search engines: %s", exc)


