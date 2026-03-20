"""
Session management API endpoints.
"""

from fastapi import APIRouter, HTTPException, status

from ..models import (
    SessionCreate, SessionInfo, SessionResponse, SessionListResponse
)
from ..services import session_manager
from ..logging_config import session_logger as logger

router = APIRouter()


@router.get("", response_model=SessionListResponse)
async def list_sessions():
    """List all active database sessions."""
    sessions = session_manager.list_sessions()
    return SessionListResponse(
        sessions=[
            SessionInfo(
                id=s.id,
                vendor=s.vendor,
                wave_db=s.wave_db,
                design_db=s.design_db,
                time_unit=s.info.time_unit,
                min_time=s.info.min_time,
                max_time=s.info.max_time,
                is_completed=s.info.is_completed,
                created_at=s.created_at
            )
            for s in sessions
        ]
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(request: SessionCreate):
    """Create a new database session."""
    logger.info(
        f"Creating session: vendor={request.vendor}, "
        f"design_db={request.design_db}, wave_db={request.wave_db}"
    )
    try:
        session = session_manager.create_session(
            vendor=request.vendor,
            wave_db=request.wave_db,
            design_db=request.design_db
        )
        logger.info(f"Session created successfully: id={session.id}")
        return SessionResponse(
            session=SessionInfo(
                id=session.id,
                vendor=session.vendor,
                wave_db=session.wave_db,
                design_db=session.design_db,
                time_unit=session.info.time_unit,
                min_time=session.info.min_time,
                max_time=session.info.max_time,
                is_completed=session.info.is_completed,
                created_at=session.created_at
            )
        )
    except FileNotFoundError as e:
        logger.error(f"Database file not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create session: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to open database: {e}")


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get information about a specific session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(
        session=SessionInfo(
            id=session.id,
            vendor=session.vendor,
            wave_db=session.wave_db,
            design_db=session.design_db,
            time_unit=session.info.time_unit,
            min_time=session.info.min_time,
            max_time=session.info.max_time,
            is_completed=session.info.is_completed,
            created_at=session.created_at
        )
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_session(session_id: str):
    """Close a database session."""
    if not session_manager.close_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
