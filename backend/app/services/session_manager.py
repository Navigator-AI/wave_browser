"""
Session management service.
"""

from pathlib import Path
import uuid
from datetime import datetime
from typing import Dict, Optional, List
from dataclasses import dataclass

from adapters import BaseAdapter, get_adapter, DatabaseInfo


@dataclass
class Session:
    """Represents an open database session."""
    id: str
    vendor: str
    wave_db: Optional[str]
    design_db: Optional[str]
    design_files: List[str]
    adapter: BaseAdapter
    info: DatabaseInfo
    created_at: datetime


class SessionManager:
    """Manages database sessions."""
    
    def __init__(self, max_sessions: int = 10):
        self._sessions: Dict[str, Session] = {}
        self._max_sessions = max_sessions

    def _looks_like_rtl_input(self, design_db: Optional[str]) -> bool:
        if not design_db:
            return False

        rtl_exts = {".v", ".sv", ".vh", ".svh", ".f"}
        for token in design_db.split():
            p = Path(token)
            if p.is_dir():
                return True
            if p.suffix.lower() in rtl_exts:
                return True
        return False

    def _should_fallback_to_rtl(
        self,
        vendor: str,
        wave_db: Optional[str],
        design_db: Optional[str],
        exc: Exception,
    ) -> bool:
        if (vendor or "").lower() != "verdi":
            return False
        if wave_db:
            return False
        if not self._looks_like_rtl_input(design_db):
            return False
        return "pynpi is not available" in str(exc)

    def _extract_design_files(self, design_db: Optional[str]) -> List[str]:
        if not design_db:
            return []
        files: List[str] = []
        for token in design_db.split():
            p = Path(token)
            if p.suffix.lower() in {".v", ".sv", ".vh", ".svh", ".f"}:
                files.append(token)
        return files
    
    def create_session(self, vendor: str, wave_db: Optional[str] = None, 
                       design_db: Optional[str] = None) -> Session:
        """Create a new database session."""
        if len(self._sessions) >= self._max_sessions:
            # Find and close oldest session
            oldest = min(self._sessions.values(), key=lambda s: s.created_at)
            self.close_session(oldest.id)
        
        session_id = str(uuid.uuid4())
        resolved_vendor = vendor
        try:
            adapter = get_adapter(vendor)
            adapter.open(wave_db, design_db)
        except RuntimeError as exc:
            if self._should_fallback_to_rtl(vendor, wave_db, design_db, exc):
                resolved_vendor = "rtl"
                adapter = get_adapter("rtl")
                adapter.open(None, design_db)
            else:
                raise
        info = adapter.get_info()
        
        session = Session(
            id=session_id,
            vendor=resolved_vendor,
            wave_db=wave_db,
            design_db=design_db,
            design_files=self._extract_design_files(design_db),
            adapter=adapter,
            info=info,
            created_at=datetime.utcnow()
        )
        
        self._sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID."""
        return self._sessions.get(session_id)
    
    def close_session(self, session_id: str) -> bool:
        """Close and remove a session."""
        session = self._sessions.pop(session_id, None)
        if session:
            session.adapter.close()
            return True
        return False
    
    def list_sessions(self) -> list[Session]:
        """List all active sessions."""
        return list(self._sessions.values())
    
    def close_all(self) -> None:
        """Close all sessions."""
        for session in list(self._sessions.values()):
            self.close_session(session.id)


# Global session manager instance
session_manager = SessionManager()
