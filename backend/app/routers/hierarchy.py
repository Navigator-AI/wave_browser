"""
Hierarchy browsing API endpoints.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..models import (
    ScopeInfo, ScopeListResponse, SignalInfo, SignalListResponse,
    SignalSearchRequest, ScopeType as ModelScopeType, 
    SignalDirection as ModelSignalDirection
)
from ..services import session_manager
from adapters import ScopeType, SignalDirection

router = APIRouter()


def _convert_scope_type(st: ScopeType) -> ModelScopeType:
    """Convert adapter scope type to model scope type."""
    return ModelScopeType(st.value)


def _convert_direction(d: SignalDirection) -> ModelSignalDirection:
    """Convert adapter direction to model direction."""
    return ModelSignalDirection(d.value)


@router.get("/{session_id}/scopes", response_model=ScopeListResponse)
async def get_top_scopes(session_id: str):
    """Get top-level scopes for a session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        scopes = session.adapter.get_top_scopes()
        return ScopeListResponse(
            scopes=[
                ScopeInfo(
                    path=s.path,
                    name=s.name,
                    scope_type=_convert_scope_type(s.scope_type),
                    def_name=s.def_name,
                    has_children=s.has_children,
                    has_signals=s.has_signals
                )
                for s in scopes
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/scopes/{scope_path:path}/children", response_model=ScopeListResponse)
async def get_child_scopes(session_id: str, scope_path: str):
    """Get child scopes of a given scope."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        scopes = session.adapter.get_child_scopes(scope_path)
        return ScopeListResponse(
            scopes=[
                ScopeInfo(
                    path=s.path,
                    name=s.name,
                    scope_type=_convert_scope_type(s.scope_type),
                    def_name=s.def_name,
                    has_children=s.has_children,
                    has_signals=s.has_signals
                )
                for s in scopes
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/scopes/{scope_path:path}/signals", response_model=SignalListResponse)
async def get_signals(session_id: str, scope_path: str):
    """Get signals in a given scope."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        signals = session.adapter.get_signals(scope_path)
        return SignalListResponse(
            signals=[
                SignalInfo(
                    path=s.path,
                    name=s.name,
                    width=s.width,
                    left_range=s.left_range,
                    right_range=s.right_range,
                    direction=_convert_direction(s.direction),
                    is_real=s.is_real,
                    is_array=s.is_array,
                    is_composite=s.is_composite,
                    has_members=s.has_members
                )
                for s in signals
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/scopes/{scope_path:path}", response_model=ScopeInfo)
async def get_scope_info(session_id: str, scope_path: str):
    """Get information about a specific scope."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        scope = session.adapter.get_scope_info(scope_path)
        if not scope:
            raise HTTPException(status_code=404, detail="Scope not found")
        
        return ScopeInfo(
            path=scope.path,
            name=scope.name,
            scope_type=_convert_scope_type(scope.scope_type),
            def_name=scope.def_name,
            has_children=scope.has_children,
            has_signals=scope.has_signals
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/signals/search", response_model=SignalListResponse)
async def search_signals(session_id: str, request: SignalSearchRequest):
    """Search for signals matching a pattern."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        signals = session.adapter.search_signals(
            pattern=request.pattern,
            scope_path=request.scope_path,
            limit=request.limit
        )
        return SignalListResponse(
            signals=[
                SignalInfo(
                    path=s.path,
                    name=s.name,
                    width=s.width,
                    left_range=s.left_range,
                    right_range=s.right_range,
                    direction=_convert_direction(s.direction),
                    is_real=s.is_real,
                    is_array=s.is_array,
                    is_composite=s.is_composite,
                    has_members=s.has_members
                )
                for s in signals
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/signals/{signal_path:path}", response_model=SignalInfo)
async def get_signal_info(session_id: str, signal_path: str):
    """Get information about a specific signal."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        signal = session.adapter.get_signal_info(signal_path)
        if not signal:
            raise HTTPException(status_code=404, detail="Signal not found")
        
        return SignalInfo(
            path=signal.path,
            name=signal.name,
            width=signal.width,
            left_range=signal.left_range,
            right_range=signal.right_range,
            direction=_convert_direction(signal.direction),
            is_real=signal.is_real,
            is_array=signal.is_array,
            is_composite=signal.is_composite,
            has_members=signal.has_members
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
