from __future__ import annotations

import difflib
import re
from typing import Optional

from sqlmodel import Session, select
from models import Category


def choose_category(predicted: Optional[str], session: Session) -> Optional[str]:
    """Mapează o categorie prezisă la una existentă în DB."""
    names = session.exec(select(Category.name)).all()
    if not names:
        return None
    if predicted:
        for n in names:
            if n.lower() == predicted.lower():
                return n
        best = difflib.get_close_matches(predicted, names, n=1, cutoff=0.5)
        if best:
            return best[0]
    return names[0]


def normalize_hashtags(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    text = str(raw)
    parts = [p.strip().lstrip("#").lower() for p in re.split(r"[;,\s]+", text) if p.strip()]
    seen: set[str] = set()
    uniq: list[str] = []
    for p in parts:
        if p and p not in seen:
            seen.add(p)
            uniq.append(p)
    if not uniq:
        return None
    return ", ".join(uniq[:7])


