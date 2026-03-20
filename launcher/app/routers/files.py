"""
Files router - Local and remote file browsing
"""

from fastapi import APIRouter, HTTPException, Query
from app.models import BrowseResponse, FileEntry
from app.services.file_browser import browse_local, browse_remote

router = APIRouter()


@router.get("/browse", response_model=BrowseResponse)
async def browse_files(
    host: str = Query("local", description="Host name ('local' or SSH host)"),
    path: str = Query("~", description="Path to browse")
):
    """
    Browse files on local or remote host.
    
    - For local: directly lists the filesystem
    - For remote: uses SFTP via SSH
    
    The path can use ~ for home directory.
    Only shows directories and .kdb/.fsdb files.
    """
    try:
        if host == "local":
            return await browse_local(path)
        else:
            return await browse_remote(host, path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Browse failed: {str(e)}")
