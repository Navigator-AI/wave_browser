"""
VCD adapter - parses VCD waveform files in pure Python.

This adapter is intended as a fallback when Verdi/NPI bindings are not
available. It supports:
- session open using `wave_db` pointing to a `.vcd` file
- a simple hierarchy with a single top scope (`vcd`)
- listing signals declared in the VCD
- fetching waveform value changes within a time range
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import fnmatch

from .base import (
    BaseAdapter,
    DatabaseInfo,
    ScopeInfo,
    SignalInfo,
    WaveformData,
    ValueChange,
    SignalDirection,
    ScopeType,
)


@dataclass(frozen=True)
class _VcdVar:
    """VCD variable definition."""

    id: str
    name: str
    size: int


class VcdAdapter(BaseAdapter):
    def __init__(self) -> None:
        self._file_handle = None
        self._wave_path: Optional[str] = None

        # Scope model is intentionally simple: one scope holding all signals.
        self._top_scope_path = "vcd"

        # id -> var metadata
        self._vars_by_id: Dict[str, _VcdVar] = {}
        # path -> id
        self._id_by_path: Dict[str, str] = {}

        # id -> sorted list of (time, value)
        self._changes_by_id: Dict[str, List[Tuple[int, str]]] = {}

        self._time_unit: str = "time"
        self._min_time: int = 0
        self._max_time: int = 0

    def open(self, wave_db: Optional[str] = None, design_db: Optional[str] = None) -> bool:
        if not wave_db and not design_db:
            raise ValueError("At least one of wave_db or design_db must be provided")
        if not wave_db:
            # VCD adapter needs waveform data to build hierarchy/signals.
            raise ValueError("VCD adapter requires wave_db")

        path = Path(wave_db)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"VCD file not found: {wave_db}")

        self._wave_path = str(path.resolve())

        self._parse_vcd_file(self._wave_path)
        return True

    def close(self) -> None:
        self._file_handle = None
        self._wave_path = None
        self._vars_by_id.clear()
        self._id_by_path.clear()
        self._changes_by_id.clear()

    def get_info(self) -> DatabaseInfo:
        if not self._wave_path:
            raise RuntimeError("No database open")
        return DatabaseInfo(
            file_path=self._wave_path,
            time_unit=self._time_unit,
            min_time=self._min_time,
            max_time=self._max_time,
            version=None,
            simulator="vcd",
            is_completed=True,
        )

    # -------------------------------------------------------------------------
    # Hierarchy Navigation (single scope)
    # -------------------------------------------------------------------------
    def get_top_scopes(self) -> List[ScopeInfo]:
        if not self._wave_path:
            raise RuntimeError("No database open")
        return [
            ScopeInfo(
                path=self._top_scope_path,
                name="vcd",
                scope_type=ScopeType.MODULE,
                def_name=None,
                has_children=False,
                has_signals=True,
            )
        ]

    def get_child_scopes(self, scope_path: str) -> List[ScopeInfo]:
        # No nested scopes in this simplified adapter.
        if scope_path == self._top_scope_path:
            return []
        return []

    def get_scope_info(self, scope_path: str) -> Optional[ScopeInfo]:
        if scope_path != self._top_scope_path:
            return None
        return ScopeInfo(
            path=self._top_scope_path,
            name="vcd",
            scope_type=ScopeType.MODULE,
            def_name=None,
            has_children=False,
            has_signals=True,
        )

    # -------------------------------------------------------------------------
    # Signal Access
    # -------------------------------------------------------------------------
    def get_signals(self, scope_path: str) -> List[SignalInfo]:
        if not self._wave_path:
            raise RuntimeError("No database open")
        if scope_path != self._top_scope_path:
            return []

        signals: List[SignalInfo] = []
        for path, var_id in self._id_by_path.items():
            var = self._vars_by_id[var_id]
            left = var.size - 1 if var.size > 0 else 0
            right = 0
            width = var.size if var.size > 0 else 1
            signals.append(
                SignalInfo(
                    path=path,
                    name=path.split(".")[-1],
                    width=width,
                    left_range=left,
                    right_range=right,
                    direction=SignalDirection.NONE,
                    is_real=False,
                    is_array=False,
                    is_composite=False,
                    has_members=False,
                )
            )

        # Deterministic order
        signals.sort(key=lambda s: s.path.lower())
        return signals

    def get_signal_info(self, signal_path: str) -> Optional[SignalInfo]:
        if not self._wave_path:
            raise RuntimeError("No database open")
        var_id = self._id_by_path.get(signal_path)
        if not var_id:
            return None
        var = self._vars_by_id[var_id]
        left = var.size - 1 if var.size > 0 else 0
        right = 0
        width = var.size if var.size > 0 else 1
        return SignalInfo(
            path=signal_path,
            name=signal_path.split(".")[-1],
            width=width,
            left_range=left,
            right_range=right,
            direction=SignalDirection.NONE,
            is_real=False,
            is_array=False,
            is_composite=False,
            has_members=False,
        )

    def search_signals(
        self, pattern: str, scope_path: Optional[str] = None, limit: int = 100
    ) -> List[SignalInfo]:
        if not self._wave_path:
            raise RuntimeError("No database open")
        if scope_path and scope_path != self._top_scope_path:
            return []

        regex_pattern = fnmatch.translate(pattern)
        import re

        rx = re.compile(regex_pattern, re.IGNORECASE)
        results: List[SignalInfo] = []
        for s in self.get_signals(self._top_scope_path):
            if rx.match(s.path) or pattern.lower() in s.path.lower():
                results.append(s)
                if len(results) >= limit:
                    break
        return results

    # -------------------------------------------------------------------------
    # Waveform Data
    # -------------------------------------------------------------------------
    def get_waveform(
        self,
        signal_path: str,
        start_time: int,
        end_time: int,
        max_changes: int = 10000,
    ) -> WaveformData:
        if not self._wave_path:
            raise RuntimeError("No database open")
        var_id = self._id_by_path.get(signal_path)
        if not var_id:
            raise ValueError(f"Signal not found: {signal_path}")

        changes = self._changes_by_id.get(var_id, [])
        # changes are stored sorted by time
        filtered: List[ValueChange] = []
        count = 0
        for t, v in changes:
            if t < start_time:
                continue
            if t > end_time:
                break
            filtered.append(ValueChange(time=t, value=v))
            count += 1
            if count >= max_changes:
                break

        info = self.get_info()
        return WaveformData(
            signal_path=signal_path,
            start_time=start_time,
            end_time=end_time,
            time_unit=info.time_unit,
            changes=filtered,
        )

    def get_value_at_time(self, signal_path: str, time: int) -> Optional[str]:
        if not self._wave_path:
            raise RuntimeError("No database open")
        var_id = self._id_by_path.get(signal_path)
        if not var_id:
            return None
        last_val: Optional[str] = None
        for t, v in self._changes_by_id.get(var_id, []):
            if t > time:
                break
            last_val = v
        return last_val

    def get_waveforms_batch(
        self,
        signal_paths: List[str],
        start_time: int,
        end_time: int,
        max_changes: int = 10000,
    ) -> Dict[str, WaveformData]:
        # Keep simple; adapter interface expects a mapping.
        return {
            path: self.get_waveform(path, start_time, end_time, max_changes=max_changes)
            for path in signal_paths
        }

    # -------------------------------------------------------------------------
    # VCD Parsing
    # -------------------------------------------------------------------------
    def _parse_vcd_file(self, wave_db: str) -> None:
        self._vars_by_id.clear()
        self._id_by_path.clear()
        self._changes_by_id.clear()

        current_time = 0
        min_time: Optional[int] = None
        max_time: Optional[int] = None

        # Track whether we are inside initial dumpvars section
        in_dumpvars = False

        # Simple function to record value changes.
        def record(var_id: str, t: int, value: str) -> None:
            self._changes_by_id.setdefault(var_id, []).append((t, value))

        # Pre-register variables once we see $var lines.
        with open(wave_db, "r", encoding="utf-8", errors="replace") as f:
            for raw in f:
                line = raw.strip()
                if not line:
                    continue

                if line.startswith("$timescale"):
                    # Example: $timescale 1ns $end
                    tokens = line.split()
                    if len(tokens) >= 3:
                        # tokens[1]=multiplier, tokens[2]=unit
                        unit = tokens[2]
                        # Normalize common unit strings
                        self._time_unit = unit.replace("s", "sec") if unit.endswith("s") else unit
                    continue

                if line.startswith("$var"):
                    # Expected: $var <type> <size> <id> <name> $end
                    tokens = line.split()
                    if len(tokens) < 6:
                        continue
                    var_type = tokens[1]  # currently unused
                    size_str = tokens[2]
                    var_id = tokens[3]
                    var_name = tokens[4]
                    size = int(size_str) if size_str.isdigit() else 1

                    var = _VcdVar(id=var_id, name=var_name, size=size)
                    self._vars_by_id[var_id] = var
                    self._id_by_path[var_name] = var_id
                    continue

                if line.startswith("$dumpvars"):
                    in_dumpvars = True
                    continue

                if in_dumpvars:
                    # $dumpvars ends with a standalone $end line.
                    if line.startswith("$end"):
                        in_dumpvars = False
                        continue
                    # Parse initial values at time 0
                    self._parse_value_line(line, current_time, record)
                    if changes_time_seen := (current_time is not None):
                        # no-op to keep structure readable
                        pass
                    continue

                # Time marker
                if line.startswith("#"):
                    try:
                        current_time = int(line[1:])
                        if min_time is None:
                            min_time = current_time
                        max_time = current_time
                    except ValueError:
                        continue
                    continue

                # Regular value changes lines (skip directives)
                if line.startswith("$"):
                    continue

                # Value change
                if self._is_value_change_line(line):
                    self._parse_value_line(line, current_time, record)
                    if min_time is None:
                        min_time = current_time
                    max_time = current_time

        if min_time is None:
            min_time = 0
        if max_time is None:
            max_time = 0
        self._min_time = min_time
        self._max_time = max_time

    def _is_value_change_line(self, line: str) -> bool:
        # Scalar changes often look like: 0! or 1a or xZ, without spaces.
        if not line:
            return False
        if line[0] in ("0", "1", "x", "X", "z", "Z"):
            return True
        # Vector changes: b<...> <id>, h<...> <id>
        if line[0] in ("b", "B", "h", "H"):
            return True
        return False

    def _parse_value_line(
        self, line: str, time: int, record_fn
    ) -> None:
        # Vector (binary)
        if line[0] in ("b", "B"):
            # b0101 <id>
            tokens = line.split()
            if len(tokens) >= 2:
                value_bits = tokens[0][1:]
                var_id = tokens[1]
                record_fn(var_id, time, value_bits)
            return

        # Vector (hex)
        if line[0] in ("h", "H"):
            # h1a <id>
            tokens = line.split()
            if len(tokens) >= 2:
                # Keep hex string; UI doesn't require fixed format.
                value_hex = tokens[0][1:]
                var_id = tokens[1]
                record_fn(var_id, time, value_hex)
            return

        # Scalar: <value><id> with no space (common form)
        if len(line) >= 2 and line[0] in ("0", "1", "x", "X", "z", "Z"):
            value = line[0].lower()
            var_id = line[1:]
            record_fn(var_id, time, value)
            return

        # Fallback: sometimes scalar lines can be spaced (rare)
        tokens = line.split()
        if len(tokens) == 2 and tokens[0] in ("0", "1", "x", "X", "z", "Z"):
            record_fn(tokens[1], time, tokens[0].lower())

