"""
Simulation API endpoints.
Handles running Verilog simulations and generating VCD waveforms.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from typing import List, Optional
import os
from pathlib import Path
from uuid import uuid4

from .files import FileUploadResponse, FileUploadItem
from ..services.simulation_service import simulation_service, SimulationError
from ..logging_config import session_logger as logger

router = APIRouter()

# Use same upload directory as file uploads
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class SimulateRequest(BaseModel):
    """Simulation request using backend-visible paths."""
    files: List[str]


class SimulationResponse(BaseModel):
    """Simulation response payload."""
    vcd_path: str
    files: List[FileUploadItem]


class UploadPathsResponse(BaseModel):
    """Simple upload response with saved file paths."""
    files: List[str]


@router.post("/upload", response_model=UploadPathsResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload one or more files and return backend-visible paths."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    saved_paths: List[str] = []
    for upload in files:
        if not upload.filename:
            continue

        safe_name = Path(upload.filename).name
        dest_path = (UPLOAD_DIR / f"{uuid4().hex}_{safe_name}").resolve()
        content = await upload.read()
        dest_path.write_bytes(content)
        saved_paths.append(str(dest_path))

    if not saved_paths:
        raise HTTPException(status_code=400, detail="No valid files provided")

    return UploadPathsResponse(files=saved_paths)


@router.post("/simulate", response_model=SimulationResponse)
async def run_simulation(request: Request, files: Optional[List[UploadFile]] = File(default=None)):
    """
    Run Verilog simulation on uploaded .v files.
    
    Compiles and simulates the provided Verilog files using iverilog and vvp.
    Returns path to generated VCD waveform file.
    
    Args:
        files: List of .v files to simulate
        
    Returns:
        FileUploadResponse with path to generated VCD file
    """
    content_type = (request.headers.get("content-type") or "").lower()
    verilog_files: List[str] = []

    if "application/json" in content_type:
        payload = SimulateRequest.model_validate(await request.json())
        if not payload.files:
            raise HTTPException(status_code=400, detail="No files provided")

        for file_path in payload.files:
            p = Path(file_path).expanduser().resolve()
            if not p.exists():
                raise HTTPException(status_code=400, detail=f"File does not exist: {file_path}")
            if not p.is_file():
                raise HTTPException(status_code=400, detail=f"Path is not a file: {file_path}")
            if not p.name.lower().endswith((".v", ".sv", ".vh", ".svh")):
                raise HTTPException(
                    status_code=400,
                    detail=f"Only Verilog files (.v, .sv, .vh, .svh) are supported, got: {p.name}",
                )
            verilog_files.append(str(p))
    else:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

    try:
        if files:
            # Save uploaded .v files temporarily
            for upload in files:
                if not upload.filename:
                    continue

                # Validate file extension
                if not upload.filename.lower().endswith((".v", ".sv", ".vh", ".svh")):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Only Verilog files (.v, .sv, .vh, .svh) are supported, got: {upload.filename}",
                    )

                # Save to upload directory
                safe_name = Path(upload.filename).name
                dest_path = UPLOAD_DIR / safe_name

                content = await upload.read()
                dest_path.write_bytes(content)
                verilog_files.append(str(dest_path))
                logger.info(f"Saved Verilog file: {dest_path}")
        
        if not verilog_files:
            raise HTTPException(status_code=400, detail="No valid Verilog files provided")
        
        # Run simulation
        logger.info(f"Starting simulation for {len(verilog_files)} file(s)")
        vcd_path = simulation_service.run_simulation(verilog_files)
        logger.info(f"Simulation completed: {vcd_path}")
        
        # Return VCD file path to frontend
        # Frontend can then use this path with existing session creation
        item = FileUploadItem(
            original_name="simulation_output.vcd",
            path=vcd_path,
            size=os.path.getsize(vcd_path) if os.path.exists(vcd_path) else 0,
        )
        return SimulationResponse(vcd_path=vcd_path, files=[item])
        
    except SimulationError as e:
        logger.error(f"Simulation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )
    except FileNotFoundError as e:
        logger.error(f"Required tool not found: {e}")
        raise HTTPException(
            status_code=500,
            detail=(
                f"Simulation tools not available: {str(e)}. "
                "Ensure iverilog and vvp are installed and in PATH."
            )
        )
    except Exception as e:
        logger.error(f"Unexpected error during simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
