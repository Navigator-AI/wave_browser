"""
Request logging middleware for FastAPI.

Logs all incoming requests and outgoing responses with timing information.
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .logging_config import api_logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all HTTP requests and responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        
        # Log request
        api_logger.info(
            f"[{request_id}] → {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params),
                "client": request.client.host if request.client else "unknown",
            }
        )
        
        # Time the request
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log response
            log_level = "info" if response.status_code < 400 else "warning" if response.status_code < 500 else "error"
            getattr(api_logger, log_level)(
                f"[{request_id}] ← {response.status_code} ({duration_ms:.1f}ms)",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            api_logger.error(
                f"[{request_id}] ✗ Exception: {type(e).__name__}: {str(e)} ({duration_ms:.1f}ms)",
                extra={
                    "request_id": request_id,
                    "exception": type(e).__name__,
                    "error": str(e),
                    "duration_ms": duration_ms,
                },
                exc_info=True
            )
            raise
