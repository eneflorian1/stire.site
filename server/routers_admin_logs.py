from typing import List

from fastapi import Depends
from sqlmodel import Session, select

from db import get_session
from models import IndexingLog
from routers_admin import router as admin_router


@admin_router.get("/admin/indexing-logs", response_model=List[IndexingLog])
def list_indexing_logs(session: Session = Depends(get_session)) -> List[IndexingLog]:
    """
    Returnează toate log-urile de indexare din tabela IndexingLog,
    ordonate descrescător după data creării.
    """
    stmt = select(IndexingLog).order_by(IndexingLog.created_at.desc())
    return session.exec(stmt).all()


