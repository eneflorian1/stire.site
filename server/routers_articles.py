from datetime import datetime
from typing import List, Optional, Any, cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, desc
from sqlmodel import Session, select

from db import get_session
from deps import require_api_key
from models import Article, ArticleCreate, ArticleUpdate
from pydantic import BaseModel
import re
from html import escape


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


@router.post("/articles", response_model=Article, dependencies=[Depends(require_api_key)])
def create_article(payload: ArticleCreate, session: Session = Depends(get_session)) -> Article:
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
    return article


@router.put("/articles/{article_id}", response_model=Article, dependencies=[Depends(require_api_key)])
def update_article(
    article_id: str,
    payload: ArticleUpdate,
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
    value = title.lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:120]


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
            if 'rel=' not in tag:
                return tag[:-1] + ' rel="nofollow noopener">'
            # If rel exists but doesn't include both, append missing
            rel_val_match = re.search(r"rel=\"([^\"]*)\"", tag)
            if not rel_val_match:
                return tag
            rel_val = rel_val_match.group(1)
            needed = [v for v in ["nofollow", "noopener"] if v not in rel_val.split()]
            if needed:
                new_rel = rel_val + " " + " ".join(needed)
                tag = re.sub(r"rel=\"[^\"]*\"", f'rel="{new_rel}"', tag)
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
        related_items.append(f'<li><a href="/article/{a_slug}--{a.id}">{escape(a.title)}</a></li>')
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

    body_html = ''.join(paragraphs_html)
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

