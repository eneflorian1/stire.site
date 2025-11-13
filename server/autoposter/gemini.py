from __future__ import annotations

import os
import json
from typing import Optional, Sequence
from urllib import request, error as urlerror


def call_gemini(api_key: str, topic_name: str, category_options: Sequence[str]) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
    """Apelează Google Generative Language API pentru sugestii brute."""
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    instruction = (
        "Generează STRICT un JSON (fără text adițional, fără code fences) cu câmpurile:\n"
        "- title: titlu de știre profesionist, concis și puternic (max 120 caractere), fără prefixe sau ghilimele\n"
        "- category: alege DOAR din lista oferită\n"
        "- content: articol complet de știri în limba română (300–500 cuvinte), 3–6 paragrafe, clar, informativ, obiectiv; fără etichete precum 'Rezumat:' sau 'Titlu:'\n"
        "  Paragrafele trebuie SEPARATE PRIN LINII GOALE (\n\n). Evită subtitluri, liste, bullet-uri sau marcaje decorative\n"
        "  Primul paragraf trebuie să fie LEAD-ul: rezumă ideea centrală, concis, autonom (nu depinde de paragrafele următoare), 2–4 fraze, max 400 de caractere.\n"
        "  Include 3–6 ancore HTML (<a href=...>) pe cuvinte/expresii CHEIE care apar și în 'hashtags'. Leagă-le către surse autoritative (Wikipedia, site oficial, .gov/.edu) dacă sunt clare; altfel omite.\n"
        "  Ancorele trebuie să aibă: target=\"_blank\" și rel=\"nofollow noopener\". Nu face overlinking și nu folosi linkuri promoționale.\n"
        "- hashtags: 5–7 cuvinte-cheie pentru SEO, derivate din title și content, fără #, separate prin virgulă\n"
        f"Lista categorii permise: {', '.join(category_options)}.\n"
        f"Subiect: {topic_name}."
    )
    body = {
        "contents": [{"parts": [{"text": instruction}]}],
    }
    data = json.dumps(body).encode("utf-8")
    req = request.Request(endpoint, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=20) as resp:
            rtxt = resp.read().decode("utf-8")
    except urlerror.HTTPError as e:
        try:
            rtxt = e.read().decode("utf-8")
        except Exception:
            rtxt = str(e)
        raise RuntimeError(f"Gemini HTTP {e.code}: {rtxt}")
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Gemini request failed: {e}")

    try:
        robj = json.loads(rtxt)
        text = robj.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    except Exception:
        text = rtxt

    json_str = text.strip()
    if json_str.startswith("```"):
        json_str = json_str.strip("`")
        if json_str.lstrip().startswith("json"):
            json_str = json_str.split("\n", 1)[1] if "\n" in json_str else "{}"
    try:
        pobj = json.loads(json_str)
    except Exception:
        pobj = {}

    title = str(pobj.get("title") or topic_name).strip()
    category = pobj.get("category")
    content = pobj.get("content")
    hashtags = pobj.get("hashtags")
    return (
        title,
        (str(category).strip() if category else None),
        (str(content).strip() if content else None),
        (str(hashtags).strip() if hashtags else None),
    )


def call_gemini_from_sources(
    api_key: str,
    topic_name: str,
    category_options: Sequence[str],
    sources: list[dict[str, str]],
) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
    """Apelează Gemini cu conținut din surse reale pentru a compune articolul."""
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    content_parts = []
    for s in sources:
        title_text = s.get('title', '').strip()
        excerpt_text = s.get('excerpt', '').strip()
        if title_text:
            content_parts.append(title_text)
        if excerpt_text:
            content_parts.append(excerpt_text)
    unified_content = "\n\n".join(content_parts)
    if len(unified_content) > 3000:
        unified_content = unified_content[:3000].strip()

    instruction = (
        "Ești redactor. Scrie un articol jurnalistic ÎN ROMÂNĂ din conținutul de mai jos.\n"
        "Nu inventa date. Nu adăuga texte demo sau template-uri. Nu folosi 'Acest material abordează...'.\n"
        "Structură: 3–6 paragrafe coerente (400–650 cuvinte), ton clar și obiectiv.\n"
        "Paragrafele trebuie SEPARATE PRIN LINII GOALE (\n\n). Evită subtitluri, liste, bullet-uri sau marcaje decorative.\n\n"
        "Primul paragraf este LEAD-ul: rezumă ideea centrală a articolului, trebuie să fie concis, autonom (de sine stătător), 2–4 fraze, max 400 de caractere.\n\n"
        "Include 3–6 ancore HTML (<a href=...>) pe cuvinte/expresii CHEIE care apar și în 'hashtags'. Leagă-le către surse autoritative (Wikipedia, site oficial, .gov/.edu) dacă sunt clare; altfel omite.\n"
        "Ancorele trebuie să aibă: target=\"_blank\" și rel=\"nofollow noopener\". Evită overlinking și evită linkuri promoționale.\n\n"
        f"Conținut:\n{unified_content}\n\n"
        "Generează STRICT un JSON (fără text adițional, fără code fences) cu câmpurile: \n"
        "- title: titlu de știre profesionist (max 120 caractere), fără ghilimele\n"
        "- category: alege DOAR din lista oferită\n"
        "- content: articolul final (3–6 paragrafe) cu paragrafe separate prin linii goale (\n\n), fără subtitluri sau liste; primul paragraf este LEAD (concis, autonom) și include ancore conform cerințelor de mai sus\n"
        "- hashtags: 5–7 termeni SEO separați prin virgulă, fără #\n"
        f"Lista categorii permise: {', '.join(category_options)}.\n"
        f"Subiect: {topic_name}."
    )
    body = {"contents": [{"parts": [{"text": instruction}]}]}
    data = json.dumps(body).encode("utf-8")
    req = request.Request(endpoint, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=25) as resp:
            rtxt = resp.read().decode("utf-8")
    except urlerror.HTTPError as e:
        try:
            rtxt = e.read().decode("utf-8")
        except Exception:
            rtxt = str(e)
        raise RuntimeError(f"Gemini HTTP {e.code}: {rtxt}")
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Gemini request failed: {e}")

    try:
        robj = json.loads(rtxt)
        text = robj.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    except Exception:
        text = rtxt

    json_str = text.strip()
    if json_str.startswith("```"):
        json_str = json_str.strip("`")
        if json_str.lstrip().startswith("json"):
            json_str = json_str.split("\n", 1)[1] if "\n" in json_str else "{}"
    try:
        pobj = json.loads(json_str)
    except Exception:
        pobj = {}

    title = str(pobj.get("title") or topic_name).strip()
    category = pobj.get("category")
    content = pobj.get("content")
    hashtags = pobj.get("hashtags")
    return (
        title,
        (str(category).strip() if category else None),
        (str(content).strip() if content else None),
        (str(hashtags).strip() if hashtags else None),
    )


