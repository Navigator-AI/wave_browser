"""
Logging configuration for the Wave Browser backend.

This module provides structured logging with:
- Console output with colored formatting
- File logging with rotation
- Request/response logging middleware
- Configurable log levels

Usage:
    from app.logging_config import get_logger
    
    logger = get_logger(__name__)
    logger.info("Message")
    logger.error("Error", exc_info=True)
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import json

from .config import settings


# Log directory
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ("msg", "args", "exc_info", "exc_text", "stack_info",
                          "created", "filename", "funcName", "levelname", "levelno",
                          "lineno", "module", "msecs", "name", "pathname", "process",
                          "processName", "relativeCreated", "thread", "threadName",
                          "message", "asctime", "taskName"):
                log_data[key] = value
        
        return json.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """Colored console formatter."""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{color}{record.levelname}{self.RESET}"
        return super().format(record)


def get_log_level() -> int:
    """Get log level from settings."""
    level = getattr(settings, 'log_level', 'INFO').upper()
    return getattr(logging, level, logging.INFO)


def setup_logging(
    log_to_file: bool = True,
    log_to_console: bool = True,
    json_format: bool = False
) -> None:
    """
    Configure the logging system.
    
    Args:
        log_to_file: Enable file logging
        log_to_console: Enable console logging
        json_format: Use JSON format for logs
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(get_log_level())
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(get_log_level())
        
        if json_format:
            console_handler.setFormatter(JsonFormatter())
        else:
            console_handler.setFormatter(ColoredFormatter(
                "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            ))
        
        root_logger.addHandler(console_handler)
    
    # File handler
    if log_to_file:
        log_file = LOG_DIR / f"wave_browser_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)  # Always log everything to file
        file_handler.setFormatter(JsonFormatter())
        root_logger.addHandler(file_handler)
    
    # Set levels for noisy libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance.
    
    Args:
        name: Logger name (typically __name__)
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# Application-specific loggers
api_logger = logging.getLogger("wave_browser.api")
npi_logger = logging.getLogger("wave_browser.npi")
session_logger = logging.getLogger("wave_browser.session")
