from datetime import datetime, timedelta
from typing import Any, cast, Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import desc, asc, func
from sqlmodel import Session, select
from db import get_session
from models import Article
import re
from html import escape as _xml_escape
import unicodedata
from urllib.parse import quote_plus

router = APIRouter()


def _slugify(title: str) -> str:
    """Generate slug from title (same as in routers_articles.py)"""
    # Normalize and strip diacritics before slug rules
    value = unicodedata.normalize("NFKD", title)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:120]

def _iso_z(dt: datetime) -> str:
    # Treat naive datetime as UTC
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def _base_url(request: Request) -> str:
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    return f"{scheme}://{host}".rstrip("/")

def _article_url(base_url: str, article: Article) -> str:
    slug = _slugify(article.title)
    date_str = article.published_at.strftime("%d-%m-%Y") if article.published_at else ""
    category = article.category or "stiri"
    cat_slug = _slugify(category)
    return f"{base_url}/{cat_slug}/articol/{date_str}/{slug}"

# Config
LATEST_LIMIT = 1500
ARCHIVE_PAGE_SIZE = 50000
NEWS_HOURS = 48


@router.get("/sitemap.xml")
def sitemap_index(request: Request, session: Session = Depends(get_session)) -> Response:
    base_url = _base_url(request)
    # Determine counts
    total: int = session.exec(select(func.count(Article.id))).one()
    total = int(total or 0)
    # Compute archive file count (older than latest segment)
    older_count = max(total - LATEST_LIMIT, 0)
    archive_files = (older_count + ARCHIVE_PAGE_SIZE - 1) // ARCHIVE_PAGE_SIZE
    # Latest article time for lastmod hints
    published_col = cast(Any, Article.published_at)
    latest_article: Optional[Article] = session.exec(
        select(Article).order_by(desc(published_col)).limit(1)
    ).first()
    latest_mod = _iso_z(latest_article.published_at) if latest_article and latest_article.published_at else None
    # Build sitemapindex
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    # 1) News
    xml_lines.append("  <sitemap>")
    xml_lines.append(f"    <loc>{_xml_escape(base_url + '/sitemap-news.xml')}</loc>")
    if latest_mod:
        xml_lines.append(f"    <lastmod>{latest_mod}</lastmod>")
    xml_lines.append("  </sitemap>")
    # 2) Latest
    xml_lines.append("  <sitemap>")
    xml_lines.append(f"    <loc>{_xml_escape(base_url + '/sitemap-articles-latest.xml')}</loc>")
    if latest_mod:
        xml_lines.append(f"    <lastmod>{latest_mod}</lastmod>")
    xml_lines.append("  </sitemap>")
    # 3) Categories
    xml_lines.append("  <sitemap>")
    xml_lines.append(f"    <loc>{_xml_escape(base_url + '/sitemap-categories.xml')}</loc>")
    xml_lines.append("  </sitemap>")
    # 4) Archives (paged)
    for idx in range(1, archive_files + 1):
        xml_lines.append("  <sitemap>")
        xml_lines.append(f"    <loc>{_xml_escape(base_url + f'/sitemap-articles-{idx}.xml')}</loc>")
        xml_lines.append("  </sitemap>")
    # 5) Images (optional)
    xml_lines.append("  <sitemap>")
    xml_lines.append(f"    <loc>{_xml_escape(base_url + '/sitemap-images.xml')}</loc>")
    if latest_mod:
        xml_lines.append(f"    <lastmod>{latest_mod}</lastmod>")
    xml_lines.append("  </sitemap>")
    xml_lines.append("</sitemapindex>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},  # 5 minutes
    )

@router.get("/sitemap-news.xml")
def sitemap_news(request: Request, session: Session = Depends(get_session)) -> Response:
    base_url = _base_url(request)
    cutoff = datetime.utcnow() - timedelta(hours=NEWS_HOURS)
    published_col = cast(Any, Article.published_at)
    rows = session.exec(
        select(Article).where(published_col >= cutoff).order_by(desc(published_col)).limit(2000)
    ).all()
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for a in rows:
        url = _article_url(base_url, a)
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{_xml_escape(url)}</loc>")
        if a.published_at:
            xml_lines.append(f"    <lastmod>{_iso_z(a.published_at)}</lastmod>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},  # 5 minutes
    )

@router.get("/sitemap-articles-latest.xml")
def sitemap_articles_latest(request: Request, session: Session = Depends(get_session)) -> Response:
    base_url = _base_url(request)
    published_col = cast(Any, Article.published_at)
    rows = session.exec(
        select(Article).order_by(desc(published_col)).limit(LATEST_LIMIT)
    ).all()
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for a in rows:
        url = _article_url(base_url, a)
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{_xml_escape(url)}</loc>")
        if a.published_at:
            xml_lines.append(f"    <lastmod>{_iso_z(a.published_at)}</lastmod>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},  # 5 minutes
    )

@router.get("/sitemap-articles-{page}.xml")
def sitemap_articles_page(page: int, request: Request, session: Session = Depends(get_session)) -> Response:
    if page < 1:
        return Response(status_code=404)
    base_url = _base_url(request)
    # Determine older count to bound archives
    total: int = session.exec(select(func.count(Article.id))).one()
    total = int(total or 0)
    older_count = max(total - LATEST_LIMIT, 0)
    if older_count <= 0:
        return Response(status_code=404)
    start = (page - 1) * ARCHIVE_PAGE_SIZE
    if start >= older_count:
        return Response(status_code=404)
    limit = min(ARCHIVE_PAGE_SIZE, older_count - start)
    published_col = cast(Any, Article.published_at)
    rows = session.exec(
        select(Article).order_by(asc(published_col)).offset(start).limit(limit)
    ).all()
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for a in rows:
        url = _article_url(base_url, a)
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{_xml_escape(url)}</loc>")
        if a.published_at:
            xml_lines.append(f"    <lastmod>{_iso_z(a.published_at)}</lastmod>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=86400"},  # 1 day
    )

@router.get("/sitemap-categories.xml")
def sitemap_categories(request: Request, session: Session = Depends(get_session)) -> Response:
    base_url = _base_url(request)
    # Distinct categories
    cats = session.exec(select(Article.category).distinct().order_by(Article.category)).all()
    values = [c for c in cats if c]
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for c in values:
        q = quote_plus(c)
        url = f"{base_url}/categorii?cat={q}"
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{_xml_escape(url)}</loc>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )

@router.get("/sitemap-images.xml")
def sitemap_images(request: Request, session: Session = Depends(get_session)) -> Response:
    base_url = _base_url(request)
    published_col = cast(Any, Article.published_at)
    rows = session.exec(
        select(Article).order_by(desc(published_col)).limit(2000)
    ).all()
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ]
    for a in rows:
        if not a.image_url or a.image_url.startswith("data:"):
            continue
        url = _article_url(base_url, a)
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{_xml_escape(url)}</loc>")
        xml_lines.append("    <image:image>")
        xml_lines.append(f"      <image:loc>{_xml_escape(a.image_url)}</image:loc>")
        xml_lines.append("    </image:image>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")
    return Response(
        content="\n".join(xml_lines),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )

