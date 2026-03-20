"""
Launcher Service - Main Application

This service runs locally and acts as a bridge between the browser frontend
and local/remote waveform backend servers. It handles:
- SSH config parsing to discover available remote hosts
- Local and remote (SFTP) file browsing
- SSH tunnel management
- Starting/stopping backend instances (local and remote)
- Tracking active sessions
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import hosts, files, connections

app = FastAPI(
    title="Wave Browser Launcher",
    description="Manages local and remote waveform viewer connections",
    version="1.0.0"
)

# Allow CORS for frontend (any localhost port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(hosts.router, prefix="/api/hosts", tags=["hosts"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(connections.router, prefix="/api/connections", tags=["connections"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "launcher"}


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup all connections on shutdown"""
    from app.services.connection_manager import connection_manager
    await connection_manager.cleanup_all()
