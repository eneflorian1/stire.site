from __future__ import annotations

from dataclasses import dataclass
import re
import os
import json
import difflib
from urllib import request, error as urlerror, parse as urlparse
from datetime import datetime, timedelta
from threading import Event, Lock, Thread
from typing import Optional, Sequence, Any, cast
from xml.etree import ElementTree as ET
from html.parser import HTMLParser
from sqlmodel import Session, select
from sqlalchemy import desc, func, or_, and_

from db import engine
from models import Setting, AutoposterLog, Topic, TopicStatus, Article, Category


@dataclass
class Status:
    """Snapshot al stării curente a procesului Autoposter.

    - running: dacă thread‑ul rulează
    - started_at: UTC când a pornit ciclul curent
    - items_created: câte articole au fost create de la start/reset
    - last_error: ultimul mesaj de eroare (dacă a existat)
    - current_topic: numele topicului procesat în prezent sau 'Idle'
    """
    running: bool
    started_at: Optional[datetime]
    items_created: int
    last_error: Optional[str]
    current_topic: Optional[str]


class Autoposter:
    """Worker thread‑safe care rulează în background, parcurge `Topic`‑uri din baza de date
    și creează `Article`‑uri folosind Gemini. Gestionează stare, loguri și oprire grațioasă.
    """
    def __init__(self) -> None:
        """Initializează starea internă, sincronizarea și configurarea rate‑limitului.

        Citește `AUTOPOSTER_DELAY_SECONDS` din variabilele de mediu (implicit 12s).
        """
        self._lock = Lock()
        self._running = False
        self._started_at: Optional[datetime] = None
        self._items_created = 0
        self._last_error: Optional[str] = None
        self._current_topic: Optional[str] = None
        self._thread: Optional[Thread] = None
        self._stop_event = Event()
        # Delay (seconds) between topic processing steps to respect provider rate limits
        try:
            self._delay_seconds = max(1, int(os.environ.get("AUTOPOSTER_DELAY_SECONDS", "12")))
        except Exception:
            self._delay_seconds = 12

    def _wait_with_stop(self, total_seconds: float) -> None:
        """Așteaptă până la `total_seconds`, verificând periodic semnalul de oprire.

        Permite oprirea rapidă în timpul pauzelor dintre pași.
        """
        remaining = float(total_seconds)
        step = 0.5
        while remaining > 0 and not self._stop_event.is_set():
            self._stop_event.wait(timeout=min(step, remaining))
            remaining -= step

    def init(self) -> None:
        """Punct de extensie pentru inițializări viitoare. În prezent nu face nimic."""
        pass

    def _get_gemini_key(self) -> Optional[str]:
        """Returnează cheia API Gemini din tabela `Setting` ('gemini_api_key') sau None."""
        with Session(engine) as session:
            row = session.get(Setting, "gemini_api_key")
            return row.value if row else None

    def _choose_category(self, predicted: Optional[str], session: Session) -> Optional[str]:
        """Mapează o categorie prezisă la una existentă în DB.

        Întâi încearcă potrivire exactă (case-insensitive), apoi potrivire fuzzy;
        dacă nu găsește nimic, întoarce prima categorie disponibilă.
        Returnează numele categoriei sau None dacă nu există categorii.
        """
        names = session.exec(select(Category.name)).all()
        if not names:
            return None
        if predicted:
            # Exact (case-insensitive)
            for n in names:
                if n.lower() == predicted.lower():
                    return n
            # Fuzzy best match
            best = difflib.get_close_matches(predicted, names, n=1, cutoff=0.5)
            if best:
                return best[0]
        # Fallback to first available
        return names[0]

    def _normalize_hashtags(self, raw: Optional[str]) -> Optional[str]:
        if not raw:
            return None
        text = str(raw)
        parts = [p.strip().lstrip("#").lower() for p in re.split(r"[;,\s]+", text) if p.strip()]
        # dedupe preserving order
        seen: set[str] = set()
        uniq: list[str] = []
        for p in parts:
            if p and p not in seen:
                seen.add(p)
                uniq.append(p)
        if not uniq:
            return None
        return ", ".join(uniq[:7])

    def _call_gemini(self, api_key: str, topic_name: str, category_options: Sequence[str]) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
        """Apelează Google Generative Language API pentru a obține sugestii
        (title, category, content, hashtags) pentru un `topic_name`.

        Constrânge răspunsul la JSON, curăță blocurile înapoiate cu ``` și parsează.
        Ridică RuntimeError pentru erori HTTP/cerere. Returnează (title, categorie?, content?, hashtags?).
        """
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

        # Extract JSON object from the model's text
        json_str = text.strip()
        if json_str.startswith("```"):
            # remove triple-backtick wrappers if present
            json_str = json_str.strip("`")
            # remove possible language tag lines
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

    def start(self) -> None:
        """Pornește thread‑ul Autoposter dacă nu rulează deja.

        Verifică existența cheii Gemini (setează `last_error` dacă lipsește),
        resetează starea relevantă și lansează `_run()` într-un thread daemon.
        """
        with self._lock:
            if self._running:
                return
            key = self._get_gemini_key()
            if not key:
                self._last_error = "Missing Gemini API key"
                return
            self._running = True
            self._started_at = datetime.utcnow()
            self._last_error = None
            self._stop_event.clear()
            self._thread = Thread(target=self._run, name="autoposter", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """Semnalează oprirea și așteaptă închiderea grațioasă a thread‑ului."""
        with self._lock:
            if not self._running:
                return
            self._stop_event.set()
            t = self._thread
            self._thread = None
            self._running = False
            self._current_topic = None
        if t is not None:
            # Mărim timeout-ul la 10 secunde pentru a permite oprirea completă
            t.join(timeout=10)

    def reset(self) -> None:
        """Resetează contoarele volatile: `items_created` și `last_error`."""
        with self._lock:
            self._items_created = 0
            self._last_error = None

    def status(self) -> Status:
        """Returnează o fotografie thread‑safe a stării curente sub forma `Status`."""
        with self._lock:
            return Status(
                running=self._running,
                started_at=self._started_at,
                items_created=self._items_created,
                last_error=self._last_error,
                current_topic=self._current_topic,
            )

    def _run(self) -> None:
        """Bucla principală a jobului.

        - Heartbeat periodic când nu există `Topic`‑uri
        - Pentru fiecare `Topic`: setează topicul curent, respectă delay-ul,
          cere sugestii de la Gemini, mapează categoria, creează `Article`,
          face upsert `TopicStatus`, loghează și crește contorul.
        - Se oprește rapid dacă se primește semnalul de oprire

        Orice excepție neașteptată este prinsă; `last_error` este setat și rularea se oprește.
        """
        try:
            with Session(engine) as session:
                safe_log(session, "info", "🚀 Autoposter pornit")
            
            while not self._stop_event.is_set():
                topics: list[Topic] = []
                with Session(engine) as session:
                    now = datetime.utcnow()
                    # Exclude topicurile din Trends care au expirat
                    # Folosim un filtru: exclude topicurile cu imported_from='google_trends' și expires_at < now
                    all_topics = list(
                        session.exec(
                            select(Topic).order_by(desc(cast(Any, Topic.created_at)))
                        ).all()
                    )
                    # Filtrează în Python pentru a evita probleme cu tipurile SQLAlchemy
                    topics = [
                        t for t in all_topics
                        if (
                            t.imported_from is None  # Topicuri manuale
                            or t.imported_from != "google_trends"  # Alte tipuri
                            or (
                                t.imported_from == "google_trends"
                                and (t.expires_at is None or t.expires_at >= now)
                            )
                        )
                    ]
                
                if not topics:
                    with self._lock:
                        self._current_topic = "Idle"
                    self._stop_event.wait(timeout=10.0)
                    continue

                # Contoare pentru ciclul curent
                processed = 0
                posted = 0
                skipped = 0
                failed = 0

                for t in topics:
                    if self._stop_event.is_set():
                        break
                    
                    processed += 1
                    with self._lock:
                        self._current_topic = t.name
                    
                    now = datetime.utcnow()
                    
                    # Check 24h cooldown
                    with Session(engine) as session:
                        window_start = now - timedelta(hours=24)
                        existing_article = session.exec(
                            select(Article.id).where(
                                Article.source == "Autoposter",
                                Article.published_at >= window_start
                            ).where(
                                func.lower(Article.title).contains(t.name.lower())
                            ).limit(1)
                        ).first()
                        if existing_article:
                            skipped += 1
                            safe_log(session, "info", f"⏭️ Skip: '{t.name}' (postat recent)")
                            continue
                    
                    # Rate limiting delay
                    self._wait_with_stop(self._delay_seconds)
                    if self._stop_event.is_set():
                        break
                    
                    # Procesare articol
                    posted_ok = False
                    with Session(engine) as session:
                        existing_categories = session.exec(select(Category.name)).all()
                        title, predicted_category, content, hashtags = (t.name, None, None, None)
                        api_key = self._get_gemini_key()
                        
                        # Căutare surse
                        sources: list[dict[str, str]] = []
                        try:
                            sources = self._fetch_news_sources(t.name, max_results=3)
                            if sources:
                                safe_log(session, "info", f"📰 '{t.name}': {len(sources)} surse găsite")
                        except Exception as fetch_err:  # noqa: BLE001
                            safe_log(session, "warning", f"⚠️ '{t.name}': căutare surse eșuată")
                        
                        # Extragere imagine principală - caută doar pe Google Images
                        main_image_url: Optional[str] = None
                        
                        try:
                            # Caută mai multe imagini (max 5) pentru a avea opțiuni
                            image_candidates = self._search_google_images(t.name, max_results=5)
                            
                            if image_candidates:
                                # Folosește prima imagine validă
                                main_image_url = image_candidates[0]
                                safe_log(session, "info", f"🖼️ '{t.name}': imagine găsită pe Google Images ({len(image_candidates)} opțiuni)")
                                
                                # Verifică dacă prima imagine este validă (lungime, format)
                                if not self._validate_image_url(main_image_url):
                                    # Dacă prima nu e validă, încearcă a doua
                                    if len(image_candidates) > 1:
                                        main_image_url = image_candidates[1]
                                        safe_log(session, "info", f"🖼️ '{t.name}': folosind a doua imagine (prima invalidă)")
                                    else:
                                        main_image_url = None
                                        safe_log(session, "warning", f"⚠️ '{t.name}': prima imagine invalidă, nu există alternativă")
                            else:
                                safe_log(session, "info", f"⚠️ '{t.name}': nu s-a găsit imagine pe Google Images")
                        except Exception as img_err:  # noqa: BLE001
                            safe_log(session, "warning", f"⚠️ '{t.name}': căutare Google Images eșuată - {str(img_err)[:60]}")
                        
                        # Fallback la placeholder gri dacă nu s-a găsit nimic
                        if not main_image_url:
                            safe_log(session, "info", f"⚠️ '{t.name}': nu s-a găsit imagine, folosind placeholder")
                            # SVG gri deschis (placeholder) - va fi detectat în frontend
                            main_image_url = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+"
                        
                        # Generare conținut
                        try:
                            if api_key and len(sources) >= 1:
                                title, predicted_category, content, hashtags = self._call_gemini_from_sources(api_key, t.name, existing_categories, sources)
                            elif not sources:
                                failed += 1
                                safe_log(session, "warning", f"⚠️ '{t.name}': fără surse disponibile")
                                continue
                        except Exception as gen_err:  # noqa: BLE001
                            failed += 1
                            safe_log(session, "error", f"❌ '{t.name}': eroare Gemini - {str(gen_err)[:80]}")
                            continue

                        mapped_category = self._choose_category(predicted_category, session) or (existing_categories[0] if existing_categories else t.name)

                        if content and content.strip():
                            article = Article(
                                title=title[:120],
                                summary=(content),
                                image_url=main_image_url,
                                source="Autoposter",
                                category=mapped_category,
                                published_at=now,
                                hashtags=self._normalize_hashtags(hashtags),
                            )
                            session.add(article)
                            
                            st = session.get(TopicStatus, t.id)
                            if not st:
                                st = TopicStatus(topic_id=t.id)
                            st.last_posted_at = now
                            st.last_result = "posted"
                            st.last_error = None
                            st.updated_at = now
                            session.add(st)
                            session.commit()
                            posted_ok = True
                            posted += 1
                            safe_log(session, "info", f"✅ '{t.name}' → '{title[:50]}...' [{mapped_category}]")
                        else:
                            failed += 1
                            st = session.get(TopicStatus, t.id)
                            if not st:
                                st = TopicStatus(topic_id=t.id)
                            st.last_posted_at = now
                            st.last_result = "error"
                            st.last_error = "Conținut indisponibil"
                            st.updated_at = now
                            session.add(st)
                            session.commit()
                            safe_log(session, "warning", f"⚠️ '{t.name}': conținut gol, nu s-a postat")
                    
                    if posted_ok:
                        with self._lock:
                            self._items_created += 1
                            self._last_error = None

                # Rezumat ciclu
                with self._lock:
                    self._current_topic = "Idle"
                with Session(engine) as session:
                    safe_log(session, "info", f"🔄 Ciclu finalizat: {posted} postate | {skipped} skip | {failed} eșuate din {processed} topicuri")
                self._stop_event.wait(timeout=5.0)
                
        except Exception as exc:  # noqa: BLE001
            with Session(engine) as session:
                safe_log(session, "error", f"💥 Eroare critică: {str(exc)[:150]}")
            with self._lock:
                self._last_error = str(exc)
                self._running = False


    # --- Research helpers (Google News RSS + simple content extraction) ---
    def _fetch_news_sources(self, query: str, max_results: int = 3) -> list[dict[str, str]]:
        """Caută în Google News (RSS) și întoarce până la `max_results` surse.

        Fără chei API: folosește feed‑ul public RSS. Pentru fiecare item, încearcă să
        rezolve URL‑ul publicat și extrage un scurt fragment de conținut.
        Fallback: dacă extragerea paginii eșuează (timeout/captcha), folosește descrierea RSS.
        """
        results: list[dict[str, str]] = []
        # Build RSS search URL (Romanian locale)
        q = urlparse.quote_plus(query)
        rss_url = (
            f"https://news.google.com/rss/search?q={q}&hl=ro&gl=RO&ceid=RO%3Aro"
        )
        try:
            req = request.Request(
                rss_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/rss+xml, application/xml, text/xml",
                    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
                },
                method="GET",
            )
            with request.urlopen(req, timeout=15) as resp:
                data = resp.read()
        except Exception:
            return results

        try:
            root = ET.fromstring(data)
        except Exception:
            return results

        # RSS: channel/item
        channel = root.find("channel")
        if channel is None:
            return results
        for item in channel.findall("item"):
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            title = (title_el.text or "").strip() if title_el is not None else ""
            link = (link_el.text or "").strip() if link_el is not None else ""
            description_html = (desc_el.text or "").strip() if desc_el is not None else ""
            clean_desc = self._strip_html(description_html)
            if not title:
                continue
            # Resolve publisher URL if link is a news.google.com redirect with url= param
            final_link = self._extract_publisher_url(link) if link else ""
            # Start with RSS description as fallback
            excerpt = clean_desc
            # Try to fetch page text (best effort, timeout-safe)
            if final_link:
                page_text = self._fetch_page_text(final_link)
                if page_text and len(page_text) > len(clean_desc):
                    excerpt = (page_text[:1200]).strip()
            # Accept source even if only RSS description is available
            if excerpt or title:
                results.append({"title": title, "url": final_link, "excerpt": excerpt})
            if len(results) >= max_results:
                break
        return results

    def _extract_publisher_url(self, link: str) -> str:
        """Dacă linkul RSS este către news.google.com, extrage parametrul url= către publisher.
        În caz contrar, întoarce linkul ca atare.
        """
        try:
            parsed = urlparse.urlparse(link)
            if "news.google.com" in (parsed.netloc or ""):
                qs = urlparse.parse_qs(parsed.query)
                if "url" in qs and qs["url"]:
                    return qs["url"][0]
        except Exception:
            pass
        return link

    def _strip_html(self, html_snippet: str) -> str:
        """Înlătură rapid tagurile HTML dintr-un snippet de descriere RSS."""
        # Remove tags and collapse whitespace
        text = re.sub(r"<[^>]+>", " ", html_snippet)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    class _ParagraphExtractor(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self._in_p = False
            self._in_ign = 0
            self._buf: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:  # type: ignore[override]
            t = tag.lower()
            if t in {"script", "style", "noscript"}:
                self._in_ign += 1
            elif t == "p" and self._in_ign == 0:
                self._in_p = True

        def handle_endtag(self, tag: str) -> None:  # type: ignore[override]
            t = tag.lower()
            if t in {"script", "style", "noscript"} and self._in_ign > 0:
                self._in_ign -= 1
            elif t == "p":
                self._in_p = False
                if self._buf and (not self._buf[-1].endswith("\n")):
                    self._buf.append("\n")

        def handle_data(self, data: str) -> None:  # type: ignore[override]
            if self._in_p and self._in_ign == 0:
                self._buf.append(data)

        def text(self) -> str:
            raw = "".join(self._buf)
            raw = re.sub(r"\s+", " ", raw)
            # Split into sentences roughly and join
            return raw.strip()

    def _fetch_page_text(self, url: str) -> str:
        """Descarcă pagina și extrage textul paragrafelor <p> (best effort).
        
        Timeout scurt (5s) pentru a evita blocarea pe captcha/rate-limit.
        Dacă eșuează, întoarce string gol și caller-ul va folosi descrierea RSS.
        """
        if not url:
            return ""
        try:
            req = request.Request(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
                    "Accept-Encoding": "identity",
                },
                method="GET",
            )
            with request.urlopen(req, timeout=5) as resp:
                # Decode using apparent charset or UTF-8 fallback
                charset = resp.headers.get_content_charset() or "utf-8"
                try:
                    html = resp.read().decode(charset, errors="replace")
                except Exception:
                    html = resp.read().decode("utf-8", errors="replace")
        except Exception:
            # Timeout, captcha, sau orice altă eroare: întoarce gol
            return ""

        # Quick removal of scripts/styles to reduce noise for the parser
        html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
        html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)

        parser = self._ParagraphExtractor()
        try:
            parser.feed(html)
        except Exception:
            return ""
        text = parser.text()
        return text

    def _fetch_page_html(self, url: str) -> str:
        """Descarcă HTML-ul paginii (best effort, timeout scurt).
        
        Folosit pentru extragerea imaginilor. Întoarce HTML-ul sau string gol dacă eșuează.
        """
        if not url:
            return ""
        try:
            req = request.Request(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
                    "Accept-Encoding": "identity",
                },
                method="GET",
            )
            with request.urlopen(req, timeout=5) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                try:
                    html = resp.read().decode(charset, errors="replace")
                except Exception:
                    html = resp.read().decode("utf-8", errors="replace")
                return html
        except Exception:
            return ""

    def _is_valid_banner_image(self, img_url: str) -> bool:
        """Verifică dacă un URL de imagine este un banner valid (nu logo/thumbnail).
        
        Criterii de excludere:
        - URL-uri cu parametri de dimensiuni mici (w300, h300, size=small, etc.)
        - URL-uri care conțin cuvinte-cheie de logo/icon
        - URL-uri de la servicii CDN care sugerează thumbnail-uri
        - URL-uri cu pattern-uri comune de imagini mici
        
        Returnează True dacă imaginea este validă, False altfel.
        """
        img_url_lower = img_url.lower()
        
        # Exclude cuvinte-cheie de logo/icon/avatar
        exclude_keywords = [
            "logo", "icon", "avatar", "favicon", "sprite", "thumbnail", 
            "thumb", "small", "mini", "profile", "user", "author"
        ]
        if any(keyword in img_url_lower for keyword in exclude_keywords):
            return False
        
        # Exclude URL-uri cu parametri de dimensiuni mici în query string
        # Pattern-uri: w300, h300, width=300, height=300, size=small, etc.
        size_patterns = [
            r'[=_-]w(\d+)',  # w300, width=300, _w300
            r'[=_-]h(\d+)',  # h300, height=300, _h300
            r'[=_-]size=(\d+)',  # size=300
            r'[=_-]size=small',  # size=small
            r'[=_-]s(\d+)',  # s300 (Google CDN)
            r'[=_-](\d+)x(\d+)',  # 300x300
        ]
        
        for pattern in size_patterns:
            match = re.search(pattern, img_url_lower)
            if match:
                # Dacă găsește un număr, verifică că nu e prea mic
                if 'w' in pattern or 'width' in pattern or 's' in pattern:
                    size_str = match.group(1)
                    try:
                        size = int(size_str)
                        if size < 400:  # Dimensiuni mai mici de 400px sunt probabil thumbnail-uri
                            return False
                    except (ValueError, IndexError):
                        pass
                elif 'h' in pattern or 'height' in pattern:
                    size_str = match.group(1)
                    try:
                        size = int(size_str)
                        if size < 400:
                            return False
                    except (ValueError, IndexError):
                        pass
                elif 'x' in pattern:
                    # Pattern 300x300
                    try:
                        width = int(match.group(1))
                        height = int(match.group(2))
                        if width < 400 or height < 300:  # Banner trebuie să fie larg și înalt
                            return False
                    except (ValueError, IndexError):
                        pass
                elif 'small' in pattern:
                    return False
        
        # Exclude URL-uri de la servicii CDN cu pattern-uri de thumbnail
        # Google CDN: lh3.googleusercontent.com cu parametri s0-w300-rw sau =s0-w300-rw
        if 'googleusercontent.com' in img_url_lower:
            # Pattern specific Google CDN: =s0-w300-rw sau =s300-w400-h300 sau similar
            # Verifică pattern-ul =s...-w... sau =s0-w...
            google_cdn_pattern = r'=s\d*-w(\d+)'
            match = re.search(google_cdn_pattern, img_url_lower)
            if match:
                try:
                    width = int(match.group(1))
                    # Pentru Google CDN, excludem imagini mai mici de 600px lățime
                    if width < 600:
                        return False
                except (ValueError, IndexError):
                    # Dacă nu poate extrage dimensiunea, verifică dacă există w300 sau mai mic
                    if re.search(r'=s\d*-w[0-5]\d{2}', img_url_lower):
                        return False
            
            # Verifică și alte pattern-uri: w300, h300, etc.
            if re.search(r'[=_-]w\d+[^0-9]', img_url_lower) or re.search(r'[=_-]s\d+[^0-9]', img_url_lower):
                # Verifică dimensiunea exactă
                w_match = re.search(r'[=_-]w(\d+)', img_url_lower)
                s_match = re.search(r'[=_-]s(\d+)', img_url_lower)
                if w_match:
                    try:
                        if int(w_match.group(1)) < 600:
                            return False
                    except ValueError:
                        pass
                if s_match:
                    try:
                        if int(s_match.group(1)) < 600:
                            return False
                    except ValueError:
                        pass
        
        # Exclude pattern-uri comune de imagini mici
        if any(pattern in img_url_lower for pattern in ['/thumb/', '/small/', '/mini/', '/icon/', '/logo/', '/avatar/']):
            return False
        
        return True

    def _extract_main_image_from_url(self, url: str) -> Optional[str]:
        """Extrage imaginea principală dintr-un URL de știre.
        
        Strategie:
        1. Caută og:image sau twitter:image în meta tags (prioritate)
        2. Caută imagini mari din conținut (prioritizează cele mai mari)
        3. Validare URL absolută și verificare că nu e logo/thumbnail
        
        Returnează URL-ul imaginii sau None dacă nu găsește.
        """
        if not url:
            return None
        
        html = self._fetch_page_html(url)
        if not html:
            return None
        
        # Normalize URL pentru rezolvarea URL-urilor relative
        try:
            parsed_base = urlparse.urlparse(url)
            base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
        except Exception:
            base_url = ""
        
        # 1. Caută og:image sau twitter:image meta tags (prioritate)
        og_image_patterns = [
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']',
            r'<meta\s+name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']twitter:image["\']',
        ]
        
        candidates: list[tuple[str, int]] = []  # (url, priority_score)
        
        for pattern in og_image_patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                img_url = match.group(1).strip()
                if img_url:
                    # Resolve relative URLs
                    if img_url.startswith("//"):
                        img_url = f"{parsed_base.scheme}:{img_url}"
                    elif img_url.startswith("/"):
                        img_url = f"{base_url}{img_url}"
                    elif not img_url.startswith(("http://", "https://")):
                        img_url = f"{base_url}/{img_url}"
                    
                    # Validare și verificare
                    if img_url.startswith(("http://", "https://")) and self._is_valid_banner_image(img_url):
                        # OG/Twitter images au prioritate mare
                        return img_url
        
        # 2. Caută imagini din conținut (colectează toate și sortează după dimensiuni)
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
        img_matches = re.finditer(img_pattern, html, re.IGNORECASE)
        
        for match in img_matches:
            img_url = match.group(1).strip()
            if not img_url:
                continue
            
            # Resolve relative URLs
            if img_url.startswith("//"):
                img_url = f"{parsed_base.scheme}:{img_url}"
            elif img_url.startswith("/"):
                img_url = f"{base_url}{img_url}"
            elif not img_url.startswith(("http://", "https://")):
                img_url = f"{base_url}/{img_url}"
            
            # Validare: trebuie să fie HTTP/HTTPS și să nu fie base64/data URI
            if not img_url.startswith(("http://", "https://")) or img_url.startswith("data:"):
                continue
            
            # Verificare că nu e logo/thumbnail
            if not self._is_valid_banner_image(img_url):
                continue
            
            # Extrage dimensiuni din atribute HTML
            img_tag = match.group(0)
            width = 0
            height = 0
            
            width_match = re.search(r'width=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
            height_match = re.search(r'height=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
            
            if width_match:
                try:
                    width = int(width_match.group(1))
                except ValueError:
                    pass
            if height_match:
                try:
                    height = int(height_match.group(1))
                except ValueError:
                    pass
            
            # Scor de prioritate: preferă imagini mai mari (banner/cover)
            # Dacă nu are dimensiuni, dăm prioritate medie (500)
            if width == 0 and height == 0:
                score = 500
            else:
                # Prioritate bazată pe dimensiuni: preferă imagini largi și înalte
                score = width * height
                # Bonus pentru raport de aspect tipic banner (16:9 sau similar)
                if width > 0 and height > 0:
                    aspect_ratio = width / height
                    if 1.5 <= aspect_ratio <= 2.5:  # Banner aspect ratio
                        score = int(score * 1.2)
            
            candidates.append((img_url, score))
        
        # Sortează după scor și returnează cea mai bună
        if candidates:
            candidates.sort(key=lambda x: x[1], reverse=True)
            return candidates[0][0]
        
        return None

    def _validate_image_url(self, url: str) -> bool:
        """Validează că un URL de imagine este valid și accesibil.
        
        Verifică:
        - Lungimea URL-ului (max 2048 caractere pentru baza de date)
        - Formatul URL-ului
        - Că nu este data URI sau placeholder
        
        Returnează True dacă URL-ul este valid, False altfel.
        """
        if not url or not isinstance(url, str):
            return False
        
        # Verifică lungimea (max 2048 caractere pentru majoritatea baze de date)
        if len(url) > 2048:
            return False
        
        # Nu acceptă data URIs sau placeholder-uri
        if url.startswith("data:") or url.startswith("data:image/svg+xml"):
            return False
        
        # Trebuie să fie HTTP/HTTPS
        if not url.startswith(("http://", "https://")):
            return False
        
        return True

    def _search_google_images(self, query: str, max_results: int = 5) -> list[str]:
        """Caută imagini pe Google Images pentru un query și returnează o listă de imagini valide.
        
        Folosește căutarea Google Images și extrage URL-urile din JSON embedded în HTML.
        Returnează o listă de imagini valide (banner) sortate după prioritate.
        
        Args:
            query: Căutarea pentru imagini
            max_results: Numărul maxim de imagini de returnat (default: 5)
        
        Returns:
            Listă de URL-uri de imagini valide, sortate după prioritate
        """
        if not query or not query.strip():
            return []
        
        try:
            # Construiește URL-ul de căutare Google Images
            q = urlparse.quote_plus(query)
            search_url = f"https://www.google.com/search?q={q}&tbm=isch&hl=ro&gl=RO"
            
            req = request.Request(
                search_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
                },
                method="GET",
            )
            
            with request.urlopen(req, timeout=10) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                try:
                    html = resp.read().decode(charset, errors="replace")
                except Exception:
                    html = resp.read().decode("utf-8", errors="replace")
            
            # Google Images folosește multiple metode pentru a stoca URL-urile
            found_urls: set[str] = set()
            
            # Metoda 1: Caută pattern-uri de URL-uri directe în HTML (imagini embedded)
            # Pattern: "https://example.com/image.jpg" sau https://example.com/image.jpg
            direct_url_pattern = r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"\'<>]*)?'
            matches = re.finditer(direct_url_pattern, html, re.IGNORECASE)
            for match in matches:
                url_str = match.group(0).strip()
                # Curăță ghilimele și escape-uri
                url_str = url_str.strip('"\'')
                if url_str.startswith("https://") and self._is_valid_banner_image(url_str):
                    found_urls.add(url_str)
            
            # Metoda 2: Caută în JSON embedded (AF_initDataCallback - formatul nou Google Images)
            # Google Images stochează datele în structuri JSON complexe
            # Caută pattern-uri comune: "ou":"https://..." sau "url":"https://..."
            json_patterns = [
                r'"ou"\s*:\s*"([^"]+)"',  # "ou" = original URL
                r'"url"\s*:\s*"([^"]+)"',  # "url" generic
                r'"src"\s*:\s*"([^"]+)"',  # "src"
            ]
            
            for pattern in json_patterns:
                matches = re.finditer(pattern, html, re.IGNORECASE)
                for match in matches:
                    url_str = match.group(1).strip()
                    # Curăță escape-uri JSON
                    url_str = url_str.replace('\\/', '/').replace('\\u003d', '=').replace('\\u0026', '&')
                    if url_str.startswith("https://") and self._is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            
            # Metoda 3: Caută în atribut data-src sau data-original (imagini lazy-loaded)
            lazy_patterns = [
                r'data-src=["\']([^"\']+)["\']',
                r'data-original=["\']([^"\']+)["\']',
                r'srcset=["\']([^"\']+)["\']',
            ]
            
            for pattern in lazy_patterns:
                matches = re.finditer(pattern, html, re.IGNORECASE)
                for match in matches:
                    url_str = match.group(1).strip()
                    # Pentru srcset, poate conține multiple URL-uri: url1 1x, url2 2x
                    if ' ' in url_str:
                        # Ia primul URL din srcset
                        url_str = url_str.split()[0]
                    if url_str.startswith("https://") and self._is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            
            # Metoda 4: Caută în script tags cu JSON (structuri Google Images)
            # Pattern: var _setImagesSrc sau similar
            script_pattern = r'<script[^>]*>(.*?)</script>'
            script_matches = re.finditer(script_pattern, html, re.IGNORECASE | re.DOTALL)
            for script_match in script_matches:
                script_content = script_match.group(1)
                # Caută URL-uri în conținutul script-ului
                url_matches = re.finditer(r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|gif)', script_content, re.IGNORECASE)
                for url_match in url_matches:
                    url_str = url_match.group(0).strip()
                    if self._is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            
            # Validează și sortează URL-urile
            valid_urls: list[str] = []
            for url in found_urls:
                if self._validate_image_url(url):
                    valid_urls.append(url)
            
            # Sortează pentru a prefera URL-uri mai clare (fără parametri complexe)
            sorted_urls = sorted(valid_urls, key=lambda x: (len(x.split('?')), x))
            
            # Returnează primele max_results
            return sorted_urls[:max_results]
            
        except Exception:  # noqa: BLE001
            # Dacă căutarea eșuează, returnează listă goală
            pass
        
        return []

    def _extract_main_image_from_sources(self, sources: list[dict[str, str]]) -> Optional[str]:
        """Extrage imaginea principală din sursele disponibile.
        
        Încearcă din fiecare sursă în ordine până găsește o imagine validă.
        Returnează URL-ul primei imagini găsite sau None.
        """
        if not sources:
            return None
        
        for source in sources:
            url = source.get("url", "").strip()
            if not url:
                continue
            
            try:
                img_url = self._extract_main_image_from_url(url)
                if img_url:
                    return img_url
            except Exception:  # noqa: BLE001
                # Continuă cu următoarea sursă dacă extragerea eșuează
                continue
        
        return None

    def _call_gemini_from_sources(
        self,
        api_key: str,
        topic_name: str,
        category_options: Sequence[str],
        sources: list[dict[str, str]],
    ) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
        """Apelează Gemini cu conținut din surse reale pentru a compune articolul.

        Constrânge răspunsul la JSON (fără text extra), promptul prezintă conținutul
        unificat fără a expune numărul de surse.
        """
        model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Build concatenated content from all sources
        content_parts = []
        for s in sources:
            title_text = s.get('title', '').strip()
            excerpt_text = s.get('excerpt', '').strip()
            if title_text:
                content_parts.append(title_text)
            if excerpt_text:
                content_parts.append(excerpt_text)
        unified_content = "\n\n".join(content_parts)
        # Limit total length to avoid token overflow
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


def safe_log(session: Session, level: str, message: str) -> None:
    """Scrie un mesaj în `AutoposterLog` și confirmă tranzacția."""
    row = AutoposterLog(level=level.upper(), message=message)
    session.add(row)
    session.commit()


# Singleton instance imported by the API routers
autoposter = Autoposter()


