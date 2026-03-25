"""
File browser API endpoints.
Allows browsing files on the backend machine.
"""

import os
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from uuid import uuid4


router = APIRouter()

# Directory where uploaded files are stored on the backend machine
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Safety: limit upload size (bytes)
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB


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


class FileContentResponse(BaseModel):
    """File content response"""
    path: str
    content: str
    language: str
    line_count: int


class FileUploadItem(BaseModel):
    """Single uploaded file result."""
    original_name: str
    path: str
    size: int


class FileUploadResponse(BaseModel):
    """Upload response payload."""
    files: List[FileUploadItem]


def detect_language(path: str) -> str:
    """Detect language from file extension"""
    ext = Path(path).suffix.lower()
    lang_map = {
        '.v': 'verilog',
        '.vh': 'verilog',
        '.sv': 'systemverilog',
        '.svh': 'systemverilog',
        '.vhd': 'vhdl',
        '.vhdl': 'vhdl',
        '.py': 'python',
        '.tcl': 'tcl',
        '.sdc': 'tcl',
        '.txt': 'text',
        '.log': 'text',
    }
    return lang_map.get(ext, 'text')


@router.get("/content", response_model=FileContentResponse)
async def get_file_content(path: str = Query(..., description="File path to read")):
    """
    Get the content of a file.
    Returns the file content with detected language type.
    """
    target = Path(path)
    
    # Security: resolve to absolute path
    try:
        target = target.resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    
    if not target.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {path}")
    
    # Limit file size (10MB)
    max_size = 10 * 1024 * 1024
    file_size = target.stat().st_size
    if file_size > max_size:
        raise HTTPException(status_code=400, detail=f"File too large: {file_size} bytes (max {max_size})")
    
    try:
        content = target.read_text(encoding='utf-8', errors='replace')
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    
    return FileContentResponse(
        path=str(target),
        content=content,
        language=detect_language(str(target)),
        line_count=content.count('\n') + 1,
    )


def _safe_filename(filename: str) -> str:
    # Strip any directory components, keep only the base name
    return Path(filename).name if filename else "upload"


async def _save_upload_file(upload: UploadFile, destination: Path) -> int:
    """
    Save an UploadFile to `destination` with size tracking.
    Returns the number of bytes written.
    """
    size = 0
    chunk_size = 1024 * 1024  # 1MB
    destination.parent.mkdir(parents=True, exist_ok=True)

    with destination.open("wb") as f:
        while True:
            chunk = await upload.read(chunk_size)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large (max {MAX_UPLOAD_BYTES} bytes)",
                )
            f.write(chunk)
    return size


@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Upload one or more files to the backend machine.

    The returned `path` is an absolute filesystem path that backend adapters
    can load (FSDB/KDB/Verilog).
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    uploaded: List[FileUploadItem] = []
    for upload in files:
        # FastAPI can provide None in edge cases; be defensive.
        if not upload.filename:
            continue

        safe_name = _safe_filename(upload.filename)
        dest_name = f"{uuid4().hex}_{safe_name}"
        dest_path = (UPLOAD_DIR / dest_name).resolve()

        size = await _save_upload_file(upload, dest_path)
        uploaded.append(
            FileUploadItem(
                original_name=upload.filename,
                path=str(dest_path),
                size=size,
            )
        )

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid files provided")

    return FileUploadResponse(files=uploaded)
