"""
Session management service.
"""

import uuid
from datetime import datetime
from typing import Dict, Optional
from dataclasses import dataclass

from adapters import BaseAdapter, get_adapter, DatabaseInfo


@dataclass
class Session:
    """Represents an open database session."""
    id: str
    vendor: str
    wave_db: Optional[str]
    design_db: Optional[str]
    adapter: BaseAdapter
    info: DatabaseInfo
    created_at: datetime


class SessionManager:
    """Manages database sessions."""
    
    def __init__(self, max_sessions: int = 10):
        self._sessions: Dict[str, Session] = {}
        self._max_sessions = max_sessions
    
    def create_session(self, vendor: str, wave_db: Optional[str] = None, 
                       design_db: Optional[str] = None) -> Session:
        """Create a new database session."""
        if len(self._sessions) >= self._max_sessions:
            # Find and close oldest session
            oldest = min(self._sessions.values(), key=lambda s: s.created_at)
            self.close_session(oldest.id)
        
        session_id = str(uuid.uuid4())
        adapter = get_adapter(vendor)
        adapter.open(wave_db, design_db)
        info = adapter.get_info()
        
        session = Session(
            id=session_id,
            vendor=vendor,
            wave_db=wave_db,
            design_db=design_db,
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
