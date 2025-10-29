from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
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

    stmt = stmt.order_by(Article.published_at.desc()).offset(offset).limit(limit)
    return session.exec(stmt).all()


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


def _build_content_html(article: Article, session: Session) -> str:
    slug = _slugify(article.title)

    # Helper: linkify known entities to authoritative domains
    def linkify_entities(text: str) -> tuple[str, list[tuple[str, str]]]:
        entities = [
            (re.compile(r"\bOpenAI\b", re.IGNORECASE), "OpenAI", "https://openai.com"),
            (re.compile(r"\bMicrosoft\b", re.IGNORECASE), "Microsoft", "https://microsoft.com"),
            (re.compile(r"\bMerge\s+Labs\b|\bMergeLabs\b", re.IGNORECASE), "Merge Labs", "https://mergelabs.io"),
            (re.compile(r"\bTelegram\b", re.IGNORECASE), "Telegram", "https://telegram.org"),
        ]

        used: list[tuple[str, str]] = []
        html_text = text
        for pattern, label, url in entities:
            def repl(m: re.Match) -> str:
                used.append((label, url))
                matched = m.group(0)
                return f'<a href="{url}" target="_blank" rel="nofollow noopener">{escape(matched)}</a>'
            html_text = pattern.sub(repl, html_text)
        return html_text, list(dict.fromkeys(used))  # dedupe preserving order

    # Build related internal links (same category)
    related_stmt = (
        select(Article)
        .where(Article.category == article.category, Article.id != article.id)
        .order_by(Article.published_at.desc())
        .limit(5)
    )
    related = session.exec(related_stmt).all()
    related_items = []
    for a in related:
        a_slug = _slugify(a.title)
        related_items.append(f'<li><a href="/article/{a_slug}--{a.id}">{escape(a.title)}</a></li>')
    related_html = f"<ul>{''.join(related_items)}</ul>" if related_items else ""

    # Lead paragraph with linkified entities from summary
    lead_html, used_external = linkify_entities(article.summary)

    # Small contextual paragraph (non-AI, deterministic)
    context = (
        f"<p>Acest material abordează tema \u201e{escape(article.title)}\u201d și relevanța sa în zona de {escape(article.category)}."
        f" Publicat de {escape(article.source)}.</p>"
    )

    # External backlinks (if any entities were found)
    external_html = ""
    if used_external:
        links = ''.join([f'<li><a href="{url}" target="_blank" rel="nofollow noopener">{escape(name)}</a></li>' for name, url in used_external])
        external_html = f"<p>Legături externe:</p><ul>{links}</ul>"

    # Category link and related posts
    cat_link = f'/\u003Fcat={escape(article.category)}'
    more_html = (
        f"<p>Explorează mai multe știri din categoria <a href=\"{cat_link}\">{escape(article.category)}</a> și articole similare:</p>"
        f"{related_html}"
    )

    return f"<p class=\"lead\">{lead_html}</p>{context}{external_html}{more_html}"


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
    )

