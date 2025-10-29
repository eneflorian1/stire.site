from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy import func
from sqlmodel import Session, select
from starlette.responses import RedirectResponse
from starlette.status import HTTP_303_SEE_OTHER
from starlette.templating import Jinja2Templates

from config import TEMPLATES_DIR
from db import get_session
from models import Article, ArticleCreate


router = APIRouter()
templates = Jinja2Templates(directory=TEMPLATES_DIR)


@router.get("/admin")
def admin_index(
    request: Request,
    category: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    session: Session = Depends(get_session),
):
    if page < 1:
        page = 1
    if page_size > 100:
        page_size = 100

    stmt = select(Article)
    if category and category != "Toate":
        stmt = stmt.where(Article.category == category)
    if q:
        q_norm = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Article.title).like(q_norm) | func.lower(Article.summary).like(q_norm)
        )

    total = session.exec(
        stmt.with_only_columns(func.count(Article.id)).order_by(None)
    ).one()

    stmt = stmt.order_by(Article.published_at.desc()).offset((page - 1) * page_size).limit(page_size)
    articles = session.exec(stmt).all()

    cats = session.exec(select(Article.category).distinct().order_by(Article.category)).all()
    categories = ["Toate", *[c for c in cats if c is not None]]

    return templates.TemplateResponse(
        "admin/index.html",
        {
            "request": request,
            "articles": articles,
            "q": q or "",
            "category": category or "Toate",
            "categories": categories,
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    )


@router.get("/admin/new")
def admin_new_form(request: Request, session: Session = Depends(get_session)):
    cats = session.exec(select(Article.category).distinct().order_by(Article.category)).all()
    categories = [c for c in cats if c is not None] or ["Tech", "Sport", "Economie", "Sănătate", "Cultură"]
    return templates.TemplateResponse(
        "admin/form.html",
        {"request": request, "mode": "create", "article": None, "categories": categories},
    )


@router.post("/admin/new")
def admin_create(
    request: Request,
    title: str = Form(...),
    summary: str = Form(...),
    image_url: str = Form(...),
    source: str = Form(...),
    category: str = Form(...),
    published_at: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
):
    dt = None
    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.utcnow()
    payload = ArticleCreate(
        title=title,
        summary=summary,
        image_url=image_url,
        source=source,
        category=category,
        published_at=dt,
    )
    article = Article(
        title=payload.title,
        summary=payload.summary,
        image_url=payload.image_url,
        source=payload.source,
        category=payload.category,
        published_at=payload.published_at or datetime.utcnow(),
    )
    session.add(article)
    session.commit()
    return RedirectResponse(url="/admin", status_code=HTTP_303_SEE_OTHER)


@router.get("/admin/{article_id}/edit")
def admin_edit_form(article_id: str, request: Request, session: Session = Depends(get_session)):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    cats = session.exec(select(Article.category).distinct().order_by(Article.category)).all()
    categories = [c for c in cats if c is not None]
    return templates.TemplateResponse(
        "admin/form.html",
        {"request": request, "mode": "edit", "article": article, "categories": categories},
    )


@router.post("/admin/{article_id}/edit")
def admin_update(
    article_id: str,
    title: str = Form(...),
    summary: str = Form(...),
    image_url: str = Form(...),
    source: str = Form(...),
    category: str = Form(...),
    published_at: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.title = title
    article.summary = summary
    article.image_url = image_url
    article.source = source
    article.category = category
    if published_at:
        try:
            article.published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except Exception:
            pass

    session.add(article)
    session.commit()
    session.refresh(article)
    return RedirectResponse(url="/admin", status_code=HTTP_303_SEE_OTHER)


@router.post("/admin/{article_id}/delete")
def admin_delete(article_id: str, session: Session = Depends(get_session)):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    session.delete(article)
    session.commit()
    return RedirectResponse(url="/admin", status_code=HTTP_303_SEE_OTHER)


