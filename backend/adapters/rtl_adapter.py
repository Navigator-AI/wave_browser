"""
RTL adapter - lightweight Verilog/SystemVerilog hierarchy reader in pure Python.

This adapter is intended as a design-only fallback when Verdi NPI is not
available. It supports:
- opening RTL inputs via a single file, directory, `.f` filelist, or
  space-separated file list
- browsing a static hierarchy inferred from module instantiations
- listing declared signals per scope

Waveform queries return empty/no-value results because RTL sources do not carry
time/value changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import fnmatch
import re
from typing import Dict, List, Optional, Set, Tuple

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


_RTL_SUFFIXES = {".v", ".sv", ".vh", ".svh"}


@dataclass(frozen=True)
class _SignalDecl:
    name: str
    width: int
    left: int
    right: int
    direction: SignalDirection


@dataclass(frozen=True)
class _InstDecl:
    module_name: str
    instance_name: str


@dataclass
class _ModuleDef:
    name: str
    signals: List[_SignalDecl]
    instances: List[_InstDecl]


class RtlAdapter(BaseAdapter):
    def __init__(self) -> None:
        self._design_path: Optional[str] = None
        self._modules: Dict[str, _ModuleDef] = {}
        self._top_paths: List[str] = []
        self._children: Dict[str, List[str]] = {}
        self._scopes: Dict[str, ScopeInfo] = {}
        self._signals_by_scope: Dict[str, List[SignalInfo]] = {}
        self._signals_by_path: Dict[str, SignalInfo] = {}

    def open(self, wave_db: Optional[str] = None, design_db: Optional[str] = None) -> bool:
        if wave_db:
            raise ValueError("RTL adapter supports design_db only")
        if not design_db:
            raise ValueError("RTL adapter requires design_db")

        files = self._collect_rtl_files(design_db)
        if not files:
            raise FileNotFoundError("No RTL files found in design_db input")

        self._design_path = design_db
        self._modules.clear()
        self._top_paths.clear()
        self._children.clear()
        self._scopes.clear()
        self._signals_by_scope.clear()
        self._signals_by_path.clear()

        for file_path in files:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            self._parse_modules(text)

        if not self._modules:
            raise RuntimeError("No Verilog/SystemVerilog modules found in provided files")

        self._build_scope_tree()
        return True

    def close(self) -> None:
        self._design_path = None
        self._modules.clear()
        self._top_paths.clear()
        self._children.clear()
        self._scopes.clear()
        self._signals_by_scope.clear()
        self._signals_by_path.clear()

    def get_info(self) -> DatabaseInfo:
        if not self._design_path:
            raise RuntimeError("No database open")
        return DatabaseInfo(
            file_path=self._design_path,
            time_unit="ns",
            min_time=0,
            max_time=0,
            version=None,
            simulator="rtl",
            is_completed=True,
        )

    def get_top_scopes(self) -> List[ScopeInfo]:
        if not self._design_path:
            raise RuntimeError("No database open")
        return [self._scopes[p] for p in self._top_paths if p in self._scopes]

    def get_child_scopes(self, scope_path: str) -> List[ScopeInfo]:
        if not self._design_path:
            raise RuntimeError("No database open")
        return [self._scopes[p] for p in self._children.get(scope_path, []) if p in self._scopes]

    def get_scope_info(self, scope_path: str) -> Optional[ScopeInfo]:
        return self._scopes.get(scope_path)

    def get_signals(self, scope_path: str) -> List[SignalInfo]:
        if not self._design_path:
            raise RuntimeError("No database open")
        return list(self._signals_by_scope.get(scope_path, []))

    def get_signal_info(self, signal_path: str) -> Optional[SignalInfo]:
        return self._signals_by_path.get(signal_path)

    def search_signals(
        self, pattern: str, scope_path: Optional[str] = None, limit: int = 100
    ) -> List[SignalInfo]:
        if not self._design_path:
            raise RuntimeError("No database open")

        regex_pattern = fnmatch.translate(pattern)
        rx = re.compile(regex_pattern, re.IGNORECASE)

        candidates = self._signals_by_path.items()
        if scope_path:
            prefix = scope_path + "."
            candidates = [
                (path, sig)
                for path, sig in self._signals_by_path.items()
                if path.startswith(prefix)
            ]

        out: List[SignalInfo] = []
        for path, sig in candidates:
            if rx.match(path) or pattern.lower() in path.lower() or pattern.lower() in sig.name.lower():
                out.append(sig)
                if len(out) >= limit:
                    break

        return out

    def get_waveform(
        self,
        signal_path: str,
        start_time: int,
        end_time: int,
        max_changes: int = 10000,
    ) -> WaveformData:
        if signal_path not in self._signals_by_path:
            raise ValueError(f"Signal not found: {signal_path}")
        return WaveformData(
            signal_path=signal_path,
            start_time=start_time,
            end_time=end_time,
            time_unit="ns",
            changes=[],
        )

    def get_value_at_time(self, signal_path: str, time: int) -> Optional[str]:
        _ = time
        if signal_path not in self._signals_by_path:
            return None
        return None

    def get_waveforms_batch(
        self,
        signal_paths: List[str],
        start_time: int,
        end_time: int,
        max_changes: int = 10000,
    ) -> Dict[str, WaveformData]:
        _ = max_changes
        out: Dict[str, WaveformData] = {}
        for path in signal_paths:
            if path in self._signals_by_path:
                out[path] = WaveformData(
                    signal_path=path,
                    start_time=start_time,
                    end_time=end_time,
                    time_unit="ns",
                    changes=[],
                )
        return out

    def _collect_rtl_files(self, design_db: str) -> List[Path]:
        files: List[Path] = []
        seen: Set[Path] = set()

        for raw in design_db.split():
            p = Path(raw)
            if not p.exists():
                raise FileNotFoundError(f"Design database not found: {raw}")

            if p.is_dir():
                for child in p.rglob("*"):
                    if child.is_file() and child.suffix.lower() in _RTL_SUFFIXES:
                        rp = child.resolve()
                        if rp not in seen:
                            seen.add(rp)
                            files.append(rp)
                continue

            suffix = p.suffix.lower()
            if suffix in _RTL_SUFFIXES:
                rp = p.resolve()
                if rp not in seen:
                    seen.add(rp)
                    files.append(rp)
                continue

            if suffix == ".f":
                for fp in self._parse_filelist(p):
                    rp = fp.resolve()
                    if rp not in seen:
                        seen.add(rp)
                        files.append(rp)
                continue

            raise ValueError(
                f"Unsupported design input for RTL fallback: {raw}. "
                "Use .v/.sv/.vh/.svh files, directories, or .f filelists."
            )

        return files

    def _parse_filelist(self, filelist: Path) -> List[Path]:
        base = filelist.parent
        out: List[Path] = []
        for raw in filelist.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue
            if line.startswith("+") or line.startswith("-"):
                continue

            token = line.split()[0]
            p = Path(token)
            if not p.is_absolute():
                p = base / p

            if p.exists() and p.is_file() and p.suffix.lower() in _RTL_SUFFIXES:
                out.append(p)
        return out

    def _parse_modules(self, source: str) -> None:
        text = self._strip_comments(source)

        mod_rx = re.compile(
            r"\bmodule\s+([A-Za-z_][A-Za-z0-9_$]*)\b(?P<header>.*?)\;(?P<body>.*?)\bendmodule\b",
            re.DOTALL,
        )

        for m in mod_rx.finditer(text):
            mod_name = m.group(1)
            header = m.group("header")
            body = m.group("body")

            body_signals = self._extract_signals(body)
            header_signals = self._extract_ansi_port_signals(header)
            signals = self._merge_signal_decls(body_signals + header_signals)

            instances = self._extract_instances(body)
            self._modules[mod_name] = _ModuleDef(mod_name, signals, instances)

    def _strip_comments(self, text: str) -> str:
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
        return text

    def _extract_signals(self, body: str) -> List[_SignalDecl]:
        out: List[_SignalDecl] = []
        decl_rx = re.compile(r"\b(input|output|inout|wire|reg|logic|tri)\b([^;]*);", re.DOTALL)

        for m in decl_rx.finditer(body):
            kind = m.group(1)
            decl = m.group(2)

            direction = SignalDirection.NONE
            if kind == "input":
                direction = SignalDirection.INPUT
            elif kind == "output":
                direction = SignalDirection.OUTPUT
            elif kind == "inout":
                direction = SignalDirection.INOUT

            left = 0
            right = 0
            width = 1
            range_m = re.search(r"\[\s*(\d+)\s*:\s*(\d+)\s*\]", decl)
            if range_m:
                left = int(range_m.group(1))
                right = int(range_m.group(2))
                width = abs(left - right) + 1

            cleaned = re.sub(r"\[[^\]]+\]", " ", decl)
            cleaned = re.sub(
                r"\b(signed|unsigned|wire|reg|logic|tri|var|const|input|output|inout)\b",
                " ",
                cleaned,
            )

            for chunk in cleaned.split(","):
                token = chunk.split("=")[0].strip()
                name_m = re.match(r"([A-Za-z_][A-Za-z0-9_$]*)", token)
                if not name_m:
                    continue
                out.append(
                    _SignalDecl(
                        name=name_m.group(1),
                        width=width,
                        left=left,
                        right=right,
                        direction=direction,
                    )
                )

        return self._merge_signal_decls(out)

    def _extract_ansi_port_signals(self, header: str) -> List[_SignalDecl]:
        groups = self._extract_parenthesized_groups(header)
        if not groups:
            return []

        ports_blob = groups[-1]
        out: List[_SignalDecl] = []

        for entry in self._split_top_level_commas(ports_blob):
            chunk = entry.strip()
            if not chunk:
                continue

            direction = SignalDirection.NONE
            if re.search(r"\binput\b", chunk):
                direction = SignalDirection.INPUT
            elif re.search(r"\boutput\b", chunk):
                direction = SignalDirection.OUTPUT
            elif re.search(r"\binout\b", chunk):
                direction = SignalDirection.INOUT
            else:
                # Non-ANSI style lists don't include direction/type.
                continue

            left = 0
            right = 0
            width = 1
            range_m = re.search(r"\[\s*(\d+)\s*:\s*(\d+)\s*\]", chunk)
            if range_m:
                left = int(range_m.group(1))
                right = int(range_m.group(2))
                width = abs(left - right) + 1

            cleaned = re.sub(r"\[[^\]]+\]", " ", chunk)
            cleaned = re.sub(
                r"\b(input|output|inout|wire|reg|logic|tri|signed|unsigned|var|const)\b",
                " ",
                cleaned,
            )
            token = cleaned.split("=")[0].strip()
            name_m = re.search(r"([A-Za-z_][A-Za-z0-9_$]*)", token)
            if not name_m:
                continue

            out.append(
                _SignalDecl(
                    name=name_m.group(1),
                    width=width,
                    left=left,
                    right=right,
                    direction=direction,
                )
            )

        return self._merge_signal_decls(out)

    def _extract_parenthesized_groups(self, text: str) -> List[str]:
        groups: List[str] = []
        depth = 0
        start = -1
        for idx, ch in enumerate(text):
            if ch == "(":
                if depth == 0:
                    start = idx + 1
                depth += 1
            elif ch == ")":
                if depth > 0:
                    depth -= 1
                    if depth == 0 and start >= 0:
                        groups.append(text[start:idx])
                        start = -1
        return groups

    def _split_top_level_commas(self, text: str) -> List[str]:
        out: List[str] = []
        start = 0
        paren = 0
        bracket = 0
        brace = 0

        for idx, ch in enumerate(text):
            if ch == "(":
                paren += 1
            elif ch == ")":
                paren = max(0, paren - 1)
            elif ch == "[":
                bracket += 1
            elif ch == "]":
                bracket = max(0, bracket - 1)
            elif ch == "{":
                brace += 1
            elif ch == "}":
                brace = max(0, brace - 1)
            elif ch == "," and paren == 0 and bracket == 0 and brace == 0:
                out.append(text[start:idx])
                start = idx + 1

        out.append(text[start:])
        return out

    def _merge_signal_decls(self, signals: List[_SignalDecl]) -> List[_SignalDecl]:
        uniq: Dict[str, _SignalDecl] = {}
        for sig in signals:
            uniq[sig.name] = sig
        return list(uniq.values())

    def _extract_instances(self, body: str) -> List[_InstDecl]:
        out: List[_InstDecl] = []
        inst_rx = re.compile(
            r"(^|;)\s*([A-Za-z_][A-Za-z0-9_$]*)\s*(?:#\s*\(.*?\)\s*)?([A-Za-z_][A-Za-z0-9_$]*)\s*\(",
            re.DOTALL,
        )

        for m in inst_rx.finditer(body):
            module_name = m.group(2)
            inst_name = m.group(3)
            if module_name in {"if", "for", "while", "case", "assign", "always", "initial"}:
                continue
            out.append(_InstDecl(module_name=module_name, instance_name=inst_name))

        return out

    def _build_scope_tree(self) -> None:
        referenced: Set[str] = set()
        for mod in self._modules.values():
            for inst in mod.instances:
                referenced.add(inst.module_name)

        top_module_names = [name for name in self._modules.keys() if name not in referenced]
        if not top_module_names:
            top_module_names = list(self._modules.keys())

        for top in top_module_names:
            self._instantiate_scope(top, top, visited=set(), depth=0)
            self._top_paths.append(top)

    def _instantiate_scope(self, module_name: str, path: str, visited: Set[Tuple[str, str]], depth: int) -> None:
        if depth > 32:
            return
        key = (module_name, path)
        if key in visited:
            return
        visited.add(key)

        mod = self._modules.get(module_name)
        if not mod:
            return

        children_paths: List[str] = []
        for inst in mod.instances:
            child_path = f"{path}.{inst.instance_name}"
            if inst.module_name in self._modules:
                self._instantiate_scope(inst.module_name, child_path, visited=set(visited), depth=depth + 1)
                children_paths.append(child_path)

        signals: List[SignalInfo] = []
        for sig in mod.signals:
            signal_path = f"{path}.{sig.name}"
            info = SignalInfo(
                path=signal_path,
                name=sig.name,
                width=sig.width,
                left_range=sig.left,
                right_range=sig.right,
                direction=sig.direction,
                is_real=False,
                is_array=False,
                is_composite=False,
                has_members=False,
            )
            signals.append(info)
            self._signals_by_path[signal_path] = info

        self._signals_by_scope[path] = signals
        self._children[path] = children_paths
        self._scopes[path] = ScopeInfo(
            path=path,
            name=path.split(".")[-1],
            scope_type=ScopeType.MODULE,
            def_name=module_name,
            has_children=len(children_paths) > 0,
            has_signals=len(signals) > 0,
        )