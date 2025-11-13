from __future__ import annotations

import re
from typing import Optional, Any
from urllib import request, parse as urlparse
from xml.etree import ElementTree as ET
from html.parser import HTMLParser


def fetch_news_sources(query: str, max_results: int = 3) -> list[dict[str, str]]:
    """Caută în Google News (RSS) și întoarce până la `max_results` surse."""
    results: list[dict[str, str]] = []
    q = urlparse.quote_plus(query)
    rss_url = f"https://news.google.com/rss/search?q={q}&hl=ro&gl=RO&ceid=RO%3Aro"
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

    channel = root.find("channel")
    if channel is None:
        return results
    for item in channel.findall("item"):
        title_el = item.find("title")
        link_el = item.find("link")
        desc_el = item.find("description")
        media_image_url = None
        try:
            media_ns = "{http://search.yahoo.com/mrss/}"
            media_content = item.find(f"{media_ns}content")
            if media_content is not None:
                media_image_url = (media_content.attrib.get("url") or "").strip() or None
            if not media_image_url:
                media_thumb = item.find(f"{media_ns}thumbnail")
                if media_thumb is not None:
                    media_image_url = (media_thumb.attrib.get("url") or "").strip() or None
            if not media_image_url:
                enclosure = item.find("enclosure")
                if enclosure is not None and (enclosure.attrib.get("type") or "").startswith("image/"):
                    media_image_url = (enclosure.attrib.get("url") or "").strip() or None
        except Exception:
            media_image_url = None
        title = (title_el.text or "").strip() if title_el is not None else ""
        link = (link_el.text or "").strip() if link_el is not None else ""
        description_html = (desc_el.text or "").strip() if desc_el is not None else ""
        # Attempt to extract first <img src> from description HTML as backup
        desc_img_url = None
        try:
            m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description_html, re.IGNORECASE)
            if m:
                desc_img_url = m.group(1).strip()
        except Exception:
            desc_img_url = None
        clean_desc = strip_html(description_html)
        if not title:
            continue
        final_link = extract_publisher_url(link) if link else ""
        excerpt = clean_desc
        if final_link:
            page_text = fetch_page_text(final_link)
            if page_text and len(page_text) > len(clean_desc):
                excerpt = (page_text[:1200]).strip()
        if excerpt or title:
            img_hint = media_image_url or desc_img_url or None
            results.append({"title": title, "url": final_link, "excerpt": excerpt, "image": (img_hint or "")})
        if len(results) >= max_results:
            break
    return results


def extract_publisher_url(link: str) -> str:
    """Dacă linkul RSS este către news.google.com, extrage parametrul url= către publisher."""
    try:
        parsed = urlparse.urlparse(link)
        if "news.google.com" in (parsed.netloc or ""):
            qs = urlparse.parse_qs(parsed.query)
            if "url" in qs and qs["url"]:
                return qs["url"][0]
    except Exception:
        pass
    return link


def strip_html(html_snippet: str) -> str:
    """Înlătură rapid tagurile HTML dintr-un snippet de descriere RSS."""
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
        return raw.strip()


def fetch_page_text(url: str) -> str:
    """Descarcă pagina și extrage textul paragrafelor <p> (best effort)."""
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
    except Exception:
        return ""

    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)

    parser = _ParagraphExtractor()
    try:
        parser.feed(html)
    except Exception:
        return ""
    text = parser.text()
    return text


def fetch_page_html(url: str) -> str:
    """Descarcă HTML-ul paginii (best effort, timeout scurt)."""
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


