from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import Repository
from app.api.downloads import ReportFormat, report_download
from app.api.mappers import analysis_out
from app.api.schemas.analysis import AnalysisOut, FindingDecisionIn
from app.application import reports, stories

router = APIRouter(tags=["analyses"])


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: str, repo: Repository) -> AnalysisOut:
    analysis = repo.get_analysis(analysis_id)
    if analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Análisis no encontrado")
    return analysis_out(analysis)


@router.get("/analyses/{analysis_id}/report")
def analysis_report(analysis_id: str, repo: Repository, format: ReportFormat = "md") -> Response:
    analysis = repo.get_analysis(analysis_id)
    stored = repo.get_story(analysis.story_id) if analysis else None
    if analysis is None or stored is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Análisis no encontrado")
    text = reports.analysis_markdown(stored.story, analysis)
    return report_download(
        text, reports.filename(stored.story.title, "analisis"), "Reporte de análisis", format
    )


@router.patch("/findings/{finding_id}", response_model=AnalysisOut)
def decide_finding(finding_id: str, payload: FindingDecisionIn, repo: Repository) -> AnalysisOut:
    """Acepta o descarta un hallazgo y devuelve el análisis con el puntaje recalculado."""
    analysis = stories.decide_finding(repo, finding_id, payload.decision, payload.dismiss_reason)
    return analysis_out(analysis)
