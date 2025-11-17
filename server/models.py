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
    hashtags: Optional[str] = None


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
    # Sursă opțională (ex: "google_trends"); None pentru cele introduse manual
    imported_from: Optional[str] = None
    # Momentul expirării pentru topicurile temporare (ex: trenduri valabile 24h)
    expires_at: Optional[datetime] = None


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
    use_animated_banner: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnnouncementCreate(SQLModel):
    title: str
    content: str
    topic: Optional[str] = None
    use_animated_banner: bool = False


class AnnouncementUpdate(SQLModel):
    title: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None
    use_animated_banner: Optional[bool] = None


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


class IndexingEvent(SQLModel, table=True):
    """
    Log simplu pentru evenimente de ping/indexare, astfel încât să se poată
    vedea în DB când a fost trimis ultimul submit pentru un articol.
    """

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    article_id: str = Field(index=True)
    provider: str
    status: str
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

