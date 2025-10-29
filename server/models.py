from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlmodel import Field, SQLModel


class ArticleBase(SQLModel):
    title: str
    summary: str
    image_url: str
    source: str
    published_at: datetime
    category: str


class Article(ArticleBase, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)


class ArticleCreate(SQLModel):
    title: str
    summary: str
    image_url: str
    source: str
    category: str
    published_at: Optional[datetime] = None


class ArticleUpdate(SQLModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    image_url: Optional[str] = None
    source: Optional[str] = None
    category: Optional[str] = None
    published_at: Optional[datetime] = None


class Category(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    name: str = Field(index=True)


class CategoryCreate(SQLModel):
    name: str


class CategoryUpdate(SQLModel):
    name: Optional[str] = None


class Topic(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TopicCreate(SQLModel):
    name: str
    description: Optional[str] = None


class TopicUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Announcement(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    title: str
    content: str
    topic: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnnouncementCreate(SQLModel):
    title: str
    content: str
    topic: Optional[str] = None


class AnnouncementUpdate(SQLModel):
    title: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True, index=True)
    value: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GeminiKeyPayload(SQLModel):
    gemini_api_key: str


class AutoposterLog(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    ts: datetime = Field(default_factory=datetime.utcnow)
    level: str
    message: str


class AutoposterStatus(SQLModel):
    running: bool
    started_at: Optional[datetime]
    items_created: int
    last_error: Optional[str]
    current_topic: Optional[str]


# Tracks last posting outcome per topic for cooldown/LED status
class TopicStatus(SQLModel, table=True):
    topic_id: str = Field(primary_key=True, index=True)
    last_posted_at: Optional[datetime] = None
    last_result: Optional[str] = None  # 'posted' | 'error'
    last_error: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

