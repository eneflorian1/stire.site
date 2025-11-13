from sqlmodel import Session, SQLModel, create_engine

from config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def get_session() -> Session:
    with Session(engine) as session:
        yield session


