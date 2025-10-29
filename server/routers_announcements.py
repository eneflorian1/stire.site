from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import get_session
from deps import require_api_key
from models import Announcement, AnnouncementCreate, AnnouncementUpdate


router = APIRouter()


@router.get("/announcements", response_model=List[Announcement])
def list_announcements(session: Session = Depends(get_session)) -> List[Announcement]:
    return session.exec(select(Announcement).order_by(Announcement.created_at.desc())).all()


@router.post("/announcements", response_model=Announcement, dependencies=[Depends(require_api_key)])
def create_announcement(payload: AnnouncementCreate, session: Session = Depends(get_session)) -> Announcement:
    ann = Announcement(title=payload.title, content=payload.content, topic=payload.topic)
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return ann


@router.put("/announcements/{announcement_id}", response_model=Announcement, dependencies=[Depends(require_api_key)])
def update_announcement(announcement_id: str, payload: AnnouncementUpdate, session: Session = Depends(get_session)) -> Announcement:
    ann = session.get(Announcement, announcement_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ann, k, v)
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return ann


@router.delete("/announcements/{announcement_id}", status_code=204, dependencies=[Depends(require_api_key)])
def delete_announcement(announcement_id: str, session: Session = Depends(get_session)) -> None:
    ann = session.get(Announcement, announcement_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    session.delete(ann)
    session.commit()


