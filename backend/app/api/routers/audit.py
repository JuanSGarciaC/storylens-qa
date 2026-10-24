from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Audit, Projects
from app.api.schemas.audit import AuditEventOut
from app.application.projects import require_project

router = APIRouter(tags=["audit"])


@router.get("/projects/{project_id}/audit", response_model=list[AuditEventOut])
def list_audit(
    project_id: str,
    projects: Projects,
    audit: Audit,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditEventOut]:
    require_project(projects, project_id)
    events = audit.list_events(project_id, limit=limit, offset=offset)
    return [AuditEventOut(**vars(e)) for e in events]
