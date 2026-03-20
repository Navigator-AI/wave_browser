"""
Adapter package for vendor-specific wave/design database access.
"""

from .base import (
    BaseAdapter,
    DatabaseInfo,
    ScopeInfo,
    SignalInfo,
    WaveformData,
    ValueChange,
    SignalDirection,
    ScopeType
)

from .verdi_adapter import VerdiAdapter, get_adapter

__all__ = [
    "BaseAdapter",
    "DatabaseInfo", 
    "ScopeInfo",
    "SignalInfo",
    "WaveformData",
    "ValueChange",
    "SignalDirection",
    "ScopeType",
    "VerdiAdapter",
    "get_adapter"
]
