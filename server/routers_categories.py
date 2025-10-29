from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from db import get_session
from deps import require_api_key
from models import Category, CategoryCreate, CategoryUpdate, Article


router = APIRouter()


@router.get("/categories", response_model=List[str])
def list_categories(session: Session = Depends(get_session)) -> List[str]:
    managed = session.exec(select(Category.name).order_by(Category.name)).all()
    if managed:
        return ["Toate", *managed]
    rows = session.exec(select(Article.category).distinct().order_by(Article.category)).all()
    return ["Toate", *[c for c in rows if c is not None]]


@router.get("/categories/raw", response_model=List[Category])
def list_categories_raw(session: Session = Depends(get_session)) -> List[Category]:
    return session.exec(select(Category).order_by(Category.name)).all()


@router.post("/categories", response_model=Category, dependencies=[Depends(require_api_key)])
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    category = Category(name=payload.name)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=Category, dependencies=[Depends(require_api_key)])
def update_category(category_id: str, payload: CategoryUpdate, session: Session = Depends(get_session)) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(category, k, v)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204, dependencies=[Depends(require_api_key)])
def delete_category(category_id: str, session: Session = Depends(get_session)) -> None:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    session.delete(category)
    session.commit()


