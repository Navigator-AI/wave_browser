"""
Waveform data API endpoints.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..models import (
    WaveformData, WaveformResponse, WaveformBatchRequest, 
    WaveformBatchResponse, ValueChange, ValueAtTimeResponse
)
from ..services import session_manager

router = APIRouter()


@router.get("/{session_id}/signals/{signal_path:path}", response_model=WaveformResponse)
async def get_waveform(
    session_id: str,
    signal_path: str,
    start: int = Query(..., description="Start time"),
    end: int = Query(..., description="End time"),
    max_changes: int = Query(10000, ge=1, le=100000, description="Maximum value changes")
):
    """Get waveform data for a signal within a time range."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        waveform_data = session.adapter.get_waveform(
            signal_path=signal_path,
            start_time=start,
            end_time=end,
            max_changes=max_changes
        )
        return WaveformResponse(
            waveform=WaveformData(
                signal_path=waveform_data.signal_path,
                start_time=waveform_data.start_time,
                end_time=waveform_data.end_time,
                time_unit=waveform_data.time_unit,
                changes=[
                    ValueChange(time=c.time, value=c.value)
                    for c in waveform_data.changes
                ]
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/batch", response_model=WaveformBatchResponse)
async def get_waveforms_batch(session_id: str, request: WaveformBatchRequest):
    """Get waveform data for multiple signals (more efficient than individual calls)."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        waveforms = session.adapter.get_waveforms_batch(
            signal_paths=request.signal_paths,
            start_time=request.start_time,
            end_time=request.end_time,
            max_changes=request.max_changes
        )
        
        result = {}
        for path, wf in waveforms.items():
            result[path] = WaveformData(
                signal_path=wf.signal_path,
                start_time=wf.start_time,
                end_time=wf.end_time,
                time_unit=wf.time_unit,
                changes=[
                    ValueChange(time=c.time, value=c.value)
                    for c in wf.changes
                ]
            )
        
        return WaveformBatchResponse(waveforms=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/value/{signal_path:path}", response_model=ValueAtTimeResponse)
async def get_value_at_time(
    session_id: str,
    signal_path: str,
    time: int = Query(..., description="Time point")
):
    """Get signal value at a specific time."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        value = session.adapter.get_value_at_time(signal_path, time)
        return ValueAtTimeResponse(
            signal_path=signal_path,
            time=time,
            value=value
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
