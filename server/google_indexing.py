from __future__ import annotations

from sqlmodel import Session
import requests

from models import IndexingLog


def ping_sitemap(url: str) -> None:
    """
    Trimite un ping către Google pentru sitemap-ul dat, folosind endpoint-ul public
    `https://www.google.com/ping?sitemap=...`.
    """
    if not url:
        return

    try:
        resp = requests.get(
            "https://www.google.com/ping",
            params={"sitemap": url},
            timeout=10,
        )
        # Ping-ul nu trebuie să blocheze flow-ul articolului; ignorăm erorile.
        resp.raise_for_status()
    except Exception:
        return


def submit_to_google_indexing(url: str) -> None:
    """
    Placeholder pentru viitoarea integrare cu Google Indexing API.

    Intenționat lăsată neimplementată deocamdată.
    """
    # Nu implementăm încă integrarea reală
    pass


def log_index_event(session: Session, url: str, action: str, status: str) -> None:
    """
    Scrie un eveniment de indexare în tabela `IndexingLog`.

    :param session: sesiunea SQLModel activă
    :param url: URL-ul articolului sau al sitemap-ului
    :param action: \"PING\" sau \"INDEX\"
    :param status: \"SUCCESS\" sau \"ERROR\"
    """
    try:
        row = IndexingLog(url=url, action=action, status=status)
        session.add(row)
        session.commit()
    except Exception:
        # În caz de eroare de logging, nu blocăm request-ul principal
        try:
            session.rollback()
        except Exception:
            pass


