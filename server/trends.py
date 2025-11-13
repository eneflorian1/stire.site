from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta
from typing import List

import requests
from sqlmodel import Session, select

from db import engine
from models import Topic


class TrendCollector:
    def __init__(self, country: str = "RO", retries: int = 3, retry_delay: float = 2) -> None:
        self.country = country.upper()
        self.retries = retries
        self.retry_delay = retry_delay

    def search_trends(self) -> list[str]:
        url = "https://trends.google.com/_/TrendsUi/data/batchexecute"
        geo = self.country.upper()[:2]
        payload = f'f.req=[[\n  [\"i0OFE\",\"[null,null,\\\"{geo}\\\",0,null,48]\"]\n]]'
        headers = {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Mozilla/5.0",
        }

        for attempt in range(1, self.retries + 1):
            try:
                r = requests.post(url, headers=headers, data=payload, timeout=15)
                r.raise_for_status()
                raw = r.text
                for line in raw.splitlines():
                    if line.strip().startswith("["):
                        data = json.loads(line)
                        trends_json = json.loads(data[0][2])
                        items = trends_json[1]
                        trends = [item[0] for item in items]
                        # Dedupe menținând ordinea aproximativă
                        seen: set[str] = set()
                        uniq: list[str] = []
                        for t in trends:
                            if t not in seen:
                                seen.add(t)
                                uniq.append(t)
                        return uniq
            except Exception as e:  # noqa: BLE001
                logging.error(f"Eroare ({attempt}/{self.retries}): {e}")
                time.sleep(self.retry_delay)
        raise RuntimeError("Nu s-au putut obține trenduri realtime.")


def import_google_trends(country: str = "RO", keep_count: int = 48) -> dict:
    """Importă trenduri Google în tabela `Topic` ca topicuri temporare.

    Șterge toate topicurile anterioare cu `imported_from='google_trends'`, apoi inserează
    lista curentă. Manualele (imported_from is NULL) rămân neatinse.
    
    Returnează statistici: {deleted, inserted}.
    """
    collector = TrendCollector(country=country)
    trends = collector.search_trends()
    # limitează opțional numărul de trenduri
    if keep_count and keep_count > 0:
        trends = trends[:keep_count]

    expires_at = datetime.utcnow() + timedelta(hours=24)

    deleted = 0
    inserted = 0
    with Session(engine) as session:
        # Șterge toate trendurile importate anterior
        old = session.exec(select(Topic).where(Topic.imported_from == "google_trends")).all()
        for o in old:
            session.delete(o)
            deleted += 1
        session.commit()

        # Inserează noile trenduri
        for name in trends:
            name_norm = (name or "").strip()
            if not name_norm:
                continue
            t = Topic(name=name_norm, description=None, imported_from="google_trends", expires_at=expires_at)
            session.add(t)
            inserted += 1
        session.commit()

    return {"deleted": deleted, "inserted": inserted}


def purge_expired_trends() -> int:
    """Șterge topicurile importate care au expirat (expires_at < now). Returnează câte a șters."""
    now = datetime.utcnow()
    removed = 0
    with Session(engine) as session:
        rows = session.exec(
            select(Topic).where(Topic.imported_from == "google_trends").where(Topic.expires_at.is_not(None))
        ).all()
        for r in rows:
            if r.expires_at and r.expires_at <= now:
                session.delete(r)
                removed += 1
        session.commit()
    return removed


