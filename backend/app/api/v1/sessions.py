import asyncio
import json
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session as SQLAlchemySession
from backend.app.api.deps import get_current_active_user
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.schemas.session import SessionCreate, SessionUpdate, SessionResponse, SessionSummaryResponse, SessionListResponse
from backend.app.schemas.common import SessionStatus
from backend.app.schemas.report import SessionReportResponse
from backend.app.schemas.evaluation_history import EvaluationHistoryListResponse
from backend.app.schemas.timeline import TimelineListResponse
from backend.app.services.session_service import SessionService
from backend.app.services.report_service import ReportService
from backend.app.services.evaluation_history_service import EvaluationHistoryService
from backend.app.services.timeline_service import TimelineService
from backend.app.services.chat_service import ChatService

logger = logging.getLogger("curio.api.sessions")
router = APIRouter()
session_service = SessionService()
report_service = ReportService()
evaluation_history_service = EvaluationHistoryService()
timeline_service = TimelineService()
chat_service = ChatService()


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: SessionCreate,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return session_service.create_session(db, session_in, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/sessions", response_model=SessionListResponse)
def list_sessions(
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, description="Items per page (capped at 100)"),
    status: Optional[str] = Query(None, description="Filter by session status (ACTIVE, PAUSED, COMPLETED)"),
    created_after: Optional[str] = Query(None, description="Filter sessions created at or after this timestamp (ISO 8601)"),
    created_before: Optional[str] = Query(None, description="Filter sessions created at or before this timestamp (ISO 8601)"),
):
    """List sessions with pagination and optional filtering."""
    # Parse status if provided
    status_enum = None
    if status is not None:
        try:
            status_enum = SessionStatus(status.upper())
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}. Must be one of: ACTIVE, PAUSED, COMPLETED")

# Parse datetime strings if provided
    created_after_dt = None
    if created_after is not None:
        try:
            # Handle URL query string where + becomes space
            # The format 2024-01-15T12:00:00+00:00 becomes 2024-01-15T12:00:00 00:00
            # We need to restore the + in the timezone offset
            parsed = created_after
            # Find the last space which should be before the timezone offset
            last_space = parsed.rfind(" ")
            if last_space > 0 and ":" in parsed[last_space:]:
                # Replace the last space with + to restore timezone format
                parsed = parsed[:last_space] + "+" + parsed[last_space+1:]
            # Also handle Z suffix
            if parsed.endswith("Z"):
                parsed = parsed[:-1] + "+00:00"
            # Handle URL-encoded + sign
            parsed = parsed.replace("%2B", "+")
            created_after_dt = datetime.fromisoformat(parsed)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid created_after format. Use ISO 8601 (e.g., 2024-01-15T12:00:00Z or 2024-01-15T12:00:00+00:00)")

    created_before_dt = None
    if created_before is not None:
        try:
            parsed = created_before
            # Handle URL query string where + becomes space
            last_space = parsed.rfind(" ")
            if last_space > 0 and ":" in parsed[last_space:]:
                parsed = parsed[:last_space] + "+" + parsed[last_space+1:]
            if parsed.endswith("Z"):
                parsed = parsed[:-1] + "+00:00"
            parsed = parsed.replace("%2B", "+")
            created_before_dt = datetime.fromisoformat(parsed)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid created_before format. Use ISO 8601 (e.g., 2024-01-15T12:00:00Z or 2024-01-15T12:00:00+00:00)")

    return session_service.list_sessions_paginated(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status_enum,
        created_after=created_after_dt,
        created_before=created_before_dt,
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = session_service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: UUID,
    session_in: SessionUpdate,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        session = session_service.update_session(db, session_id, session_in, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    success = session_service.delete_session(db, session_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return


@router.post("/sessions/{session_id}/pause", response_model=SessionResponse)
def pause_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = session_service.update_session(
        db, session_id, SessionUpdate(status=SessionStatus.PAUSED), user_id=current_user.id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/resume", response_model=SessionResponse)
def resume_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = session_service.update_session(
        db, session_id, SessionUpdate(status=SessionStatus.ACTIVE), user_id=current_user.id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/end", response_model=SessionReportResponse)
def end_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Triggers compilation of the report and locks the session
    report = report_service.compile_report(db, session_id, user_id=current_user.id)
    if not report:
        raise HTTPException(status_code=404, detail="Session not found or failed to compile report")
    return report


@router.post("/sessions/{session_id}/evaluate", response_model=SessionReportResponse)
def evaluate_session(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Explicitly triggers session evaluation and generates a structured learning report."""
    report = report_service.compile_report(db, session_id, user_id=current_user.id)
    if not report:
        raise HTTPException(status_code=404, detail="Session not found or failed to compile report")
    return report


@router.get("/sessions/{session_id}/evaluations", response_model=EvaluationHistoryListResponse)
def get_evaluation_history(
    session_id: UUID,
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, description="Items per page (capped at 100)"),
):
    """
    Retrieve paginated evaluation history for a session.
    
    Returns chronological history of learner turns with their persisted
    evaluation and assessment data. Only accessible to the session owner.
    
    Anti-enumeration: Returns 404 for non-existent or foreign sessions.
    """
    history = evaluation_history_service.get_evaluation_history(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    if history is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return history


@router.get("/users/me/timeline", response_model=TimelineListResponse)
def get_user_timeline(
    db: SQLAlchemySession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, description="Items per page (capped at 100)"),
    session_id: Optional[UUID] = Query(None, description="Filter timeline to a specific owned session"),
    event_types: Optional[str] = Query(None, description="Comma-separated event types to include"),
    start: Optional[str] = Query(None, description="Filter events at or after this timestamp (ISO 8601)"),
    end: Optional[str] = Query(None, description="Filter events at or before this timestamp (ISO 8601)"),
):
    """
    Retrieve paginated learning timeline for the authenticated user.
    
    Returns chronological history of learning events across all owned sessions.
    Supports filtering by session, event types, and date range.
    
    Anti-enumeration: Returns 404 if session_id is provided but not owned by the user.
    """
    try:
        timeline = timeline_service.get_timeline(
            db=db,
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            session_id=session_id,
            event_types=event_types,
            start=start,
            end=end,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    
    if timeline is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return timeline


@router.websocket("/sessions/{session_id}/ws")
async def session_websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time session communication and token streaming.
    Supports heartbeats ('ping' / 'ack') and real-time question generation with streaming tokens.
    """
    await websocket.accept()
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except Exception:
                data = {}

            msg_type = data.get("type")
            if msg_type in ("ping", "ack"):
                await websocket.send_text(json.dumps({"type": "ack"}))
                continue

            if msg_type == "answer":
                content = (data.get("content") or "").strip()
                if not content:
                    continue

                try:
                    sess_uuid = UUID(session_id)
                except ValueError:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Invalid session_id"}))
                    continue

                from backend.app.db.session import SessionLocal
                from backend.app.schemas.message import MessageCreate, CommonInputType

                def run_turn():
                    db = SessionLocal()
                    try:
                        msg_in = MessageCreate(content=content, input_type=CommonInputType.TEXT)
                        events = list(chat_service.send_message_stream(db, sess_uuid, msg_in))
                        return events
                    finally:
                        db.close()

                try:
                    events = await asyncio.to_thread(run_turn)
                    for event in events:
                        if event["type"] == "chunk":
                            await websocket.send_text(json.dumps({"type": "chunk", "delta": event["delta"]}))
                            await asyncio.sleep(0.01)
                        elif event["type"] == "complete":
                            turn_data = event["data"]
                            decision = turn_data.get("decision") or {}
                            next_mode = decision.get("next_mode", "STUDENT")
                            should_restore = decision.get("should_restore_interrupted_question", False)
                            content_text = (turn_data.get("ai_message") or {}).get("content", "")
                            conf = decision.get("confidence", 50)
                            active_concept = decision.get("active_concept", "")

                            if next_mode == "TEACHER":
                                payload = {
                                    "type": "teacher_start",
                                    "content": content_text,
                                    "mode": "TEACHER",
                                    "gap": {
                                        "conceptId": active_concept,
                                        "title": active_concept,
                                        "severity": "HIGH",
                                    },
                                    "confidence": conf,
                                }
                            elif should_restore:
                                payload = {
                                    "type": "teacher_end",
                                    "content": content_text,
                                    "mode": "STUDENT",
                                    "confidence": conf,
                                }
                            else:
                                payload = {
                                    "type": "question",
                                    "content": content_text,
                                    "mode": next_mode,
                                    "confidence": conf,
                                }
                            await websocket.send_text(json.dumps(payload))
                except Exception as ex:
                    logger.exception("Error processing WS message: %s", ex)
                    await websocket.send_text(json.dumps({"type": "error", "message": str(ex)}))

    except (WebSocketDisconnect, Exception):
        pass
