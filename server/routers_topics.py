from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import get_session
from deps import require_api_key
from models import Topic, TopicCreate, TopicUpdate, TopicStatus


router = APIRouter()


@router.get("/topics", response_model=List[Topic])
def list_topics(session: Session = Depends(get_session)) -> List[Topic]:
    return session.exec(select(Topic).order_by(Topic.created_at.desc())).all()


@router.post("/topics", response_model=Topic, dependencies=[Depends(require_api_key)])
def create_topic(payload: TopicCreate, session: Session = Depends(get_session)) -> Topic:
    topic = Topic(name=payload.name, description=payload.description)
    session.add(topic)
    session.commit()
    session.refresh(topic)
    return topic


@router.put("/topics/{topic_id}", response_model=Topic, dependencies=[Depends(require_api_key)])
def update_topic(topic_id: str, payload: TopicUpdate, session: Session = Depends(get_session)) -> Topic:
    topic = session.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(topic, k, v)
    session.add(topic)
    session.commit()
    session.refresh(topic)
    return topic


@router.delete("/topics/{topic_id}", status_code=204, dependencies=[Depends(require_api_key)])
def delete_topic(topic_id: str, session: Session = Depends(get_session)) -> None:
    topic = session.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    session.delete(topic)
    session.commit()


@router.get("/topics/statuses", response_model=List[TopicStatus])
def list_topic_statuses(session: Session = Depends(get_session)) -> List[TopicStatus]:
    return session.exec(select(TopicStatus)).all()

