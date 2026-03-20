"""Data models for the launcher service"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel


class HostType(str, Enum):
    LOCAL = "local"
    REMOTE = "remote"


class SSHHost(BaseModel):
    """SSH host configuration from ~/.ssh/config"""
    name: str
    hostname: str
    user: Optional[str] = None
    port: int = 22
    identity_file: Optional[str] = None


class FileEntry(BaseModel):
    """A file or directory entry"""
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = None
    modified: Optional[str] = None


class BrowseRequest(BaseModel):
    """Request to browse files"""
    host: str  # "local" or SSH host name
    path: str


class BrowseResponse(BaseModel):
    """Response from file browsing"""
    path: str
    entries: list[FileEntry]
    parent: Optional[str] = None


class ConnectionRequest(BaseModel):
    """Request to establish a connection to a waveform database"""
    host: str  # "local" or SSH host name
    db_path: str  # Path to .kdb or .fsdb file


class ConnectionInfo(BaseModel):
    """Information about an active connection"""
    id: str
    host: str
    host_type: HostType
    db_path: str
    backend_url: str  # URL to reach the backend (e.g., http://localhost:8081)
    local_port: int   # Local port for this connection
    status: str       # "connecting", "ready", "error"
    error: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Response after establishing a connection"""
    connection: ConnectionInfo
