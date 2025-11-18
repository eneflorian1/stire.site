from datetime import datetime
from typing import List, Optional, Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, desc
from sqlmodel import Session, select

from db import get_session
from deps import require_api_key
from models import Article, ArticleCreate, ArticleUpdate
from google_indexing import ping_sitemap, log_index_event
import routers_admin_logs  # noqa: F401  - importat pentru a înregistra ruta /admin/indexing-logs
from pydantic import BaseModel
import re
from html import escape
from datetime import date as _date
import unicodedata


router = APIRouter()


@router.get("/articles", response_model=List[Article])
def list_articles(
    category: Optional[str] = None,
    q: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session),
) -> List[Article]:
    if limit > 100:
        limit = 100

    stmt = select(Article)

    if category and category != "Toate":
        stmt = stmt.where(Article.category == category)

    if q:
        q_norm = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Article.title).like(q_norm) | func.lower(Article.summary).like(q_norm)
        )

    published_col = cast(Any, Article.published_at)
    stmt = stmt.order_by(desc(published_col)).offset(offset).limit(limit)
    return list(session.exec(stmt).all())


@router.get("/articles/{article_id}", response_model=Article)
def get_article(article_id: str, session: Session = Depends(get_session)) -> Article:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


def _request_base_url(request: Request) -> str:
    """
    Construiește baza de URL (schema + host), ținând cont de X-Forwarded-* din nginx.
    """
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    return f"{scheme}://{host}".rstrip("/")


@router.post("/articles", response_model=Article, dependencies=[Depends(require_api_key)])
def create_article(
    payload: ArticleCreate,
    request: Request,
    session: Session = Depends(get_session),
) -> Article:
    published_at = payload.published_at or datetime.utcnow()
    article = Article(
        title=payload.title,
        summary=payload.summary,
        image_url=payload.image_url,
        source=payload.source,
        category=payload.category,
        published_at=published_at,
    )
    session.add(article)
    session.commit()
    session.refresh(article)

    # Notifică motoarele de căutare (ping sitemap) după salvare.
    try:
        base_url = _request_base_url(request)
        sitemap_url = f"{base_url}/sitemap.xml"
        article_url = _build_article_url(base_url, article)
        ping_sitemap(sitemap_url)
        log_index_event(session, article_url, "PING", "SUCCESS")
    except Exception:
        # Nu blocăm request-ul dacă ping-ul dă eroare.
        pass

    return article


@router.put("/articles/{article_id}", response_model=Article, dependencies=[Depends(require_api_key)])
def update_article(
    article_id: str,
    payload: ArticleUpdate,
    request: Request,
    session: Session = Depends(get_session),
) -> Article:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    session.add(article)
    session.commit()
    session.refresh(article)

    # Notifică motoarele de căutare (ping sitemap) după update.
    try:
        base_url = _request_base_url(request)
        sitemap_url = f"{base_url}/sitemap.xml"
        article_url = _build_article_url(base_url, article)
        ping_sitemap(sitemap_url)
        log_index_event(session, article_url, "PING", "SUCCESS")
    except Exception:
        pass

    return article


@router.delete("/articles/{article_id}", status_code=204, dependencies=[Depends(require_api_key)])
def delete_article(article_id: str, session: Session = Depends(get_session)) -> None:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    session.delete(article)
    session.commit()


# ---------------------------------
# SEO helpers and detail endpoint
# ---------------------------------

_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def _slugify(title: str) -> str:
    # Normalize and strip diacritics before slug rules
    value = unicodedata.normalize("NFKD", title)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:120]


def _build_article_url(base_url: str, article: Article) -> str:
    slug = _slugify(article.title)
    date_str = article.published_at.strftime("%d-%m-%Y") if article.published_at else ""
    category = article.category or "stiri"
    cat_slug = _slugify(category)
    return f"{base_url.rstrip('/')}/{cat_slug}/articol/{date_str}/{slug}"


class ArticleDetail(BaseModel):
    id: str
    title: str
    summary: str
    image_url: str
    source: str
    published_at: datetime
    category: str
    slug: str
    content_html: str
    meta_description: str
    hashtags: Optional[str] = None


def _build_content_html(article: Article, session: Session) -> str:
    slug = _slugify(article.title)

    # Helper: sanitize anchor tags to ensure rel/target attributes
    def sanitize_anchors(html_text: str) -> str:
        # Add target and rel if missing on <a ...>
        # 1) Ensure target="_blank"
        html_text = re.sub(r"<a(?![^>]*target=)[^>]*>", lambda m: m.group(0)[:-1] + ' target="_blank">', html_text)
        # 2) Ensure rel contains nofollow noopener (append if rel missing)
        def _ensure_rel(match: re.Match) -> str:
            tag = match.group(0)
            if "rel=" not in tag:
                return tag[:-1] + ' rel="nofollow noopener">'
            # If rel exists but doesn't include both, append missing
            rel_val_match = re.search(r'rel="([^"]*)"', tag)
            if not rel_val_match:
                return tag
            rel_val = rel_val_match.group(1)
            needed = [v for v in ["nofollow", "noopener"] if v not in rel_val.split()]
            if needed:
                new_rel = rel_val + " " + " ".join(needed)
                tag = re.sub(r'rel="[^"]*"', f'rel="{new_rel}"', tag)
            return tag

        html_text = re.sub(r"<a[^>]*>", _ensure_rel, html_text)
        return html_text

    # Build related internal links (same category)
    published_col_related = cast(Any, Article.published_at)
    related_stmt = (
        select(Article)
        .where(Article.category == article.category, Article.id != article.id)
        .order_by(desc(published_col_related))
        .limit(5)
    )
    related = session.exec(related_stmt).all()
    related_items = []
    for a in related:
        a_slug = _slugify(a.title)
        a_date = a.published_at.strftime("%d-%m-%Y") if a.published_at else ""
        cat_slug = _slugify(a.category) if a.category else "stiri"
        related_url = f'/{cat_slug}/articol/{a_date}/{a_slug}'
        related_items.append(f'<li><a href="{related_url}">{escape(a.title)}</a></li>')
    related_html = f"<ul>{''.join(related_items)}</ul>" if related_items else ""

    # Construiește paragrafe din `summary` (acceptă separare prin linii goale)
    raw_text = article.summary or ""
    parts = [p.strip() for p in re.split(r"\n\s*\n+", raw_text) if p and p.strip()]

    paragraphs_html: list[str] = []
    if parts:
        for idx, p in enumerate(parts):
            para_html = sanitize_anchors(p)
            paragraphs_html.append(f"<p{(' class=\"lead\"' if idx == 0 else '')}>{para_html}</p>")
    else:
        lead_html = sanitize_anchors(raw_text)
        paragraphs_html.append(f"<p class=\"lead\">{lead_html}</p>")

    # Fără listă de linkuri externe generată automat – ancorele vin din conținut (model)
    external_html = ""

    # Category link and related posts
    cat_link = f'/\u003Fcat={escape(article.category)}'
    more_html = (
        f"<p>Explorează mai multe știri din categoria <a href=\"{cat_link}\">{escape(article.category)}</a> și articole similare:</p>"
        f"{related_html}"
    )

    body_html = "".join(paragraphs_html)
    return f"{body_html}{external_html}{more_html}"


@router.get("/articles/seo/{article_id}", response_model=ArticleDetail)
def get_article_detail(article_id: str, session: Session = Depends(get_session)) -> ArticleDetail:
    # Accept either raw UUID or slug--UUID; extract UUID if present
    match = _UUID_RE.search(article_id)
    real_id = match.group(0) if match else article_id
    article = session.get(Article, real_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    slug = _slugify(article.title)
    content_html = _build_content_html(article, session)
    meta_description = (article.summary or "")[:160]

    return ArticleDetail(
        id=article.id,
        title=article.title,
        summary=article.summary,
        image_url=article.image_url,
        source=article.source,
        published_at=article.published_at,
        category=article.category,
        slug=slug,
        content_html=content_html,
        meta_description=meta_description,
        hashtags=article.hashtags,
    )


# ---------------------------------
# SEO-friendly article route
# /{category}/articol/{dd-mm-YYYY}/{slug}[--{uuid}]
# ---------------------------------
@router.get("/{category}/articol/{date_str}/{slug_path}", response_model=ArticleDetail)
def get_article_by_seo_path(
    category: str,
    date_str: str,
    slug_path: str,
    session: Session = Depends(get_session),
) -> ArticleDetail:
    # If slug contains an explicit UUID suffix, resolve by ID directly
    id_match = _UUID_RE.search(slug_path)
    if id_match:
        real_id = id_match.group(0)
        article = session.get(Article, real_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        # Optional: sanity-check category/date
        if _slugify(article.category or "") != _slugify(category or ""):
            raise HTTPException(status_code=404, detail="Article not found")
        if article.published_at and date_str != article.published_at.strftime("%d-%m-%Y"):
            raise HTTPException(status_code=404, detail="Article not found")
        slug = _slugify(article.title)
        content_html = _build_content_html(article, session)
        meta_description = (article.summary or "")[:160]
        return ArticleDetail(
            id=article.id,
            title=article.title,
            summary=article.summary,
            image_url=article.image_url,
            source=article.source,
            published_at=article.published_at,
            category=article.category,
            slug=slug,
            content_html=content_html,
            meta_description=meta_description,
            hashtags=article.hashtags,
        )

    # Parse date dd-mm-YYYY
    try:
        day, month, year = [int(p) for p in date_str.split("-")]
        target_date = _date(year, month, day)
    except Exception:
        raise HTTPException(status_code=404, detail="Article not found")

    # Query by category and same calendar day
    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, 999999)
    published_col = cast(Any, Article.published_at)
    stmt = (
        select(Article)
        .where(published_col >= start_dt, published_col <= end_dt)
        .order_by(desc(published_col))
    )
    candidates = session.exec(stmt).all()
    for article in candidates:
        if _slugify(article.title) == slug_path and _slugify(article.category or "") == _slugify(category or ""):
            slug = _slugify(article.title)
            content_html = _build_content_html(article, session)
            meta_description = (article.summary or "")[:160]
            return ArticleDetail(
                id=article.id,
                title=article.title,
                summary=article.summary,
                image_url=article.image_url,
                source=article.source,
                published_at=article.published_at,
                category=article.category,
                slug=slug,
                content_html=content_html,
                meta_description=meta_description,
                hashtags=article.hashtags,
            )

    raise HTTPException(status_code=404, detail="Article not found")


