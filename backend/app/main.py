"""
FastAPI main application entry point.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import sessions, hierarchy, waveform, files
from .config import settings
from .logging_config import setup_logging, get_logger
from .middleware import RequestLoggingMiddleware

# Initialize logging
setup_logging(
    log_to_file=settings.log_to_file,
    log_to_console=True,
    json_format=False
)

logger = get_logger(__name__)

app = FastAPI(
    title="Wave Browser API",
    description="API for browsing RTL design hierarchy and viewing waveforms",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and log them."""
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        extra={"path": request.url.path, "method": request.method},
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"}
    )


# Include routers
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(hierarchy.router, prefix="/api/hierarchy", tags=["Hierarchy"])
app.include_router(waveform.router, prefix="/api/waveform", tags=["Waveform"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Wave Browser API",
        "version": "0.1.0",
        "docs": "/docs"
    }
