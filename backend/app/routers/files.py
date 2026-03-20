"""
File browser API endpoints.
Allows browsing files on the backend machine.
"""

import os
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


router = APIRouter()


class FileEntry(BaseModel):
    """A file or directory entry"""
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = None


class FileListResponse(BaseModel):
    """File listing response"""
    path: str
    parent: Optional[str]
    entries: List[FileEntry]


class FileListRequest(BaseModel):
    """File listing request"""
    path: Optional[str] = None


@router.get("", response_model=FileListResponse)
async def list_files(path: Optional[str] = Query(None, description="Directory path to list")):
    """
    List files in a directory.
    If no path is provided, lists the user's home directory.
    """
    # Default to home directory
    if not path:
        path = str(Path.home())
    
    target = Path(path)
    
    # Security: resolve to absolute path
    try:
        target = target.resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")
    
    # Get parent path
    parent = str(target.parent) if target.parent != target else None
    
    entries: List[FileEntry] = []
    
    try:
        for item in sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            # Skip hidden files (optional - could make this configurable)
            if item.name.startswith('.'):
                continue
            
            try:
                entry = FileEntry(
                    name=item.name,
                    path=str(item),
                    is_dir=item.is_dir(),
                    size=item.stat().st_size if item.is_file() else None,
                )
                entries.append(entry)
            except PermissionError:
                # Skip files we can't access
                continue
            except OSError:
                # Skip files with other issues
                continue
                
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
    
    return FileListResponse(
        path=str(target),
        parent=parent,
        entries=entries,
    )


@router.get("/roots", response_model=List[FileEntry])
async def get_roots():
    """
    Get filesystem roots (for navigation).
    On Unix: returns /
    On Windows: returns drive letters
    """
    import platform
    
    roots: List[FileEntry] = []
    
    if platform.system() == 'Windows':
        # List drive letters
        import string
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                roots.append(FileEntry(name=drive, path=drive, is_dir=True))
    else:
        # Unix - just root
        roots.append(FileEntry(name="/", path="/", is_dir=True))
        
        # Also add home directory for convenience
        home = str(Path.home())
        roots.append(FileEntry(name="~", path=home, is_dir=True))
    
    return roots
