"""
Verilog simulation service.
Compiles and simulates Verilog files using iverilog and vvp.
Generates VCD waveform output.
"""

import os
import re
import subprocess
import tempfile
import logging
from pathlib import Path
from typing import List, Tuple

logger = logging.getLogger("wave_browser.simulation")


class SimulationError(Exception):
    """Raised when simulation fails."""
    pass


class SimulationService:
    """Service for running Verilog simulations."""
    
    # Temporary directory for simulations (reused per process)
    _temp_dir: tempfile.TemporaryDirectory | None = None
    
    @classmethod
    def _get_temp_dir(cls) -> Path:
        """Get or create a persistent temp directory for this process."""
        if cls._temp_dir is None:
            cls._temp_dir = tempfile.TemporaryDirectory(prefix="wave_sim_")
            logger.info(f"Created simulation temp directory: {cls._temp_dir.name}")
        return Path(cls._temp_dir.name)
    
    @classmethod
    def cleanup(cls) -> None:
        """Clean up temp directory on shutdown."""
        if cls._temp_dir is not None:
            cls._temp_dir.cleanup()
            cls._temp_dir = None
            logger.info("Cleaned up simulation temp directory")

    @staticmethod
    def _read_file_text(path: str) -> str:
        try:
            return Path(path).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""

    @staticmethod
    def _detect_dump_scope_module(source_text: str) -> str:
        """Detect module name to use in $dumpvars scope."""
        module_blocks = re.finditer(
            r"\bmodule\s+([A-Za-z_][A-Za-z0-9_]*)\b[\s\S]*?\bendmodule\b",
            source_text,
            re.IGNORECASE,
        )
        first_name = "tb"
        for idx, m in enumerate(module_blocks):
            name = m.group(1)
            body = m.group(0).lower()
            if idx == 0:
                first_name = name
            if "initial" in body:
                return name
        return first_name

    @staticmethod
    def fix_testbench(file_path: str) -> bool:
        """
        Replace FSDB dump calls with VCD dump setup in an uploaded testbench file.
        Returns True if file content was modified.
        """
        path = Path(file_path)
        content = SimulationService._read_file_text(file_path)
        if not content:
            return False

        lowered = content.lower()
        has_fsdb = (
            "$fsdbdumpfile" in lowered
            or "$fsdbdumpvars" in lowered
            or "$fsdbdumpmda" in lowered
        )
        if not has_fsdb:
            return False

        updated = content
        # Remove FSDB dump calls (Icarus does not support them).
        updated = re.sub(r"\$fsdbDumpfile\s*\([^;]*\)\s*;", "// removed fsdb", updated, flags=re.IGNORECASE)
        updated = re.sub(r"\$fsdbDumpvars\s*\([^;]*\)\s*;", "// removed fsdb", updated, flags=re.IGNORECASE)
        updated = re.sub(r"\$fsdbDumpMDA\s*\([^;]*\)\s*;", "// removed fsdb", updated, flags=re.IGNORECASE)

        lowered_updated = updated.lower()
        if "$dumpfile" not in lowered_updated:
            dump_scope = SimulationService._detect_dump_scope_module(updated)
            dump_block = (
                "\n    initial begin\n"
                "        $dumpfile(\"output.vcd\");\n"
                f"        $dumpvars(0, {dump_scope});\n"
                "    end\n"
            )

            end_idx = updated.lower().rfind("endmodule")
            if end_idx != -1:
                updated = updated[:end_idx] + dump_block + updated[end_idx:]
            else:
                updated = updated + dump_block

        if updated != content:
            path.write_text(updated, encoding="utf-8")
            logger.info(f"Rewrote FSDB dump calls to VCD in: {file_path}")
            return True

        return False

    @staticmethod
    def _has_testbench(verilog_files: List[str]) -> bool:
        """
        Heuristic testbench detector.
        Treat as testbench-present only if `initial` and dump setup exist.
        """
        for vf in verilog_files:
            text = SimulationService._read_file_text(vf)
            lower = text.lower()
            if "initial" in lower and ("$dumpfile" in lower or "$dumpvars" in lower):
                return True
        return False

    @staticmethod
    def _find_module_candidates(verilog_files: List[str]) -> List[Tuple[str, str]]:
        """Return (module_name, source_text) for all parsed module declarations."""
        candidates: List[Tuple[str, str]] = []
        module_re = re.compile(r"\bmodule\s+([A-Za-z_][A-Za-z0-9_]*)\b")
        for vf in verilog_files:
            text = SimulationService._read_file_text(vf)
            for match in module_re.finditer(text):
                candidates.append((match.group(1), text))
        return candidates

    @staticmethod
    def _extract_module_ports(module_name: str, source_text: str) -> List[Tuple[str, str, str]]:
        """
        Extract ANSI-style module ports.
        Returns tuples of (name, direction, width), where width is '' or '[x:y]'.
        """
        header_re = re.compile(
            rf"\bmodule\s+{re.escape(module_name)}\s*\((.*?)\)\s*;",
            re.DOTALL,
        )
        m = header_re.search(source_text)
        if not m:
            return []

        ports_blob = m.group(1)
        raw_ports = [p.strip() for p in ports_blob.split(',') if p.strip()]
        ports: List[Tuple[str, str, str]] = []

        port_re = re.compile(
            r"^(input|output|inout)\s+(?:wire|reg\s+)?(?:signed\s+)?(\[[^\]]+\]\s*)?([A-Za-z_][A-Za-z0-9_]*)$",
            re.IGNORECASE,
        )
        for raw in raw_ports:
            token = re.sub(r"\s+", " ", raw.strip())
            pm = port_re.match(token)
            if not pm:
                continue
            direction = pm.group(1).lower()
            width = (pm.group(2) or "").strip()
            name = pm.group(3)
            ports.append((name, direction, width))

        return ports

    @staticmethod
    def _extract_top_module(verilog_files: List[str]) -> str:
        """
        Extract likely DUT top module from Verilog sources.
        Preference order:
        1) first module not starting with tb/
        2) first parsed module
        """
        candidates = SimulationService._find_module_candidates(verilog_files)
        if not candidates:
            raise SimulationError("Could not parse any module declaration (expected: module <name> (...))")

        for name, _ in reversed(candidates):
            lname = name.lower()
            if not (lname.startswith("tb") or lname.endswith("_tb") or lname.startswith("testbench")):
                return name

        return candidates[0][0]

    @staticmethod
    def _generate_auto_testbench(top_module: str, ports: List[Tuple[str, str, str]]) -> str:
        """Generate an auto testbench from parsed DUT ports."""
        lines: List[str] = ["module tb;", ""]

        inputs = [p for p in ports if p[1] == "input"]
        outputs = [p for p in ports if p[1] in ("output", "inout")]

        for name, _, width in inputs:
            init = " = 0"
            decl_width = f" {width}" if width else ""
            lines.append(f"  reg{decl_width} {name}{init};")
        for name, _, width in outputs:
            decl_width = f" {width}" if width else ""
            lines.append(f"  wire{decl_width} {name};")

        lines.append("")
        clk_names = [n for (n, _, _) in inputs if n.lower() in {"clk", "clock"}]
        if clk_names:
            lines.append(f"  always #5 {clk_names[0]} = ~{clk_names[0]};")
            lines.append("")

        lines.append(f"  {top_module} dut (")
        for idx, (name, _, _) in enumerate(ports):
            comma = "," if idx < len(ports) - 1 else ""
            lines.append(f"    .{name}({name}){comma}")
        lines.append("  );")
        lines.append("")

        lines.append("  initial begin")
        lines.append("    $dumpfile(\"output.vcd\");")
        lines.append("    $dumpvars(0, tb);")
        lines.append("")

        input_names = {name.lower(): name for (name, _, _) in inputs}
        if "rst_n" in input_names:
            lines.append(f"    #20 {input_names['rst_n']} = 1;")
        elif "reset_n" in input_names:
            lines.append(f"    #20 {input_names['reset_n']} = 1;")
        elif "rst" in input_names:
            lines.append(f"    #20 {input_names['rst']} = 0;")
        elif "reset" in input_names:
            lines.append(f"    #20 {input_names['reset']} = 0;")

        if "start" in input_names:
            lines.append(f"    #10 {input_names['start']} = 1;")
            lines.append(f"    #10 {input_names['start']} = 0;")
        else:
            driven_any = False
            for name, _, _ in inputs:
                lname = name.lower()
                if lname in {"clk", "clock", "rst", "reset", "rst_n", "reset_n"}:
                    continue
                lines.append(f"    #10 {name} = 1;")
                lines.append(f"    #10 {name} = 0;")
                driven_any = True
                break
            if not driven_any:
                lines.append("    #20;")

        lines.append("")
        lines.append("    #1000;")
        lines.append("    $finish;")
        lines.append("  end")
        lines.append("")
        lines.append("endmodule")

        return "\n".join(lines) + "\n"
    
    @staticmethod
    def run_simulation(verilog_files: List[str]) -> str:
        """
        Run Verilog simulation using iverilog and vvp.
        
        Args:
            verilog_files: List of paths to .v files to simulate
            
        Returns:
            Path to generated VCD file
            
        Raises:
            SimulationError: If compilation or simulation fails
            FileNotFoundError: If iverilog or vvp not found
        """
        if not verilog_files:
            raise SimulationError("No Verilog files provided")
        
        # Verify all input files exist
        for vf in verilog_files:
            if not os.path.exists(vf):
                raise FileNotFoundError(f"Verilog file not found: {vf}")

        # Rewrite FSDB dump tasks to VCD in uploaded testbenches when needed.
        for vf in verilog_files:
            try:
                SimulationService.fix_testbench(vf)
            except Exception as exc:
                logger.warning(f"Failed to rewrite testbench '{vf}': {exc}")
        
        # Create working directory for this simulation
        work_dir = SimulationService._get_temp_dir() / f"sim_{os.getpid()}_{id(SimulationService)}"
        work_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Paths for compilation and simulation
            compiled = work_dir / "sim.vvp"
            vcd_output = work_dir / "output.vcd"
            file_paths = list(verilog_files)
            auto_tb_generated = False

            # If no testbench/dumpfile is present, auto-generate one.
            if not SimulationService._has_testbench(verilog_files):
                top_module = SimulationService._extract_top_module(verilog_files)
                top_source = "\n".join(SimulationService._read_file_text(vf) for vf in verilog_files)
                top_ports = SimulationService._extract_module_ports(top_module, top_source)
                tb_path = work_dir / "tb_auto.v"
                tb_path.write_text(
                    SimulationService._generate_auto_testbench(top_module, top_ports),
                    encoding="utf-8",
                )
                file_paths.append(str(tb_path))
                auto_tb_generated = True
                logger.info(f"No testbench detected, generated auto testbench: {tb_path} (top={top_module})")
            
            logger.info(f"Compiling Verilog files: {file_paths}")
            
            # Step 1: Compile with iverilog
            compile_cmd = ["iverilog", "-g2012", "-o", str(compiled)]
            if auto_tb_generated:
                compile_cmd += ["-s", "tb"]
            compile_cmd += file_paths
            logger.debug(f"Compile command: {' '.join(compile_cmd)}")
            
            result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                logger.error(f"Compilation failed:\n{result.stderr}")
                raise SimulationError(
                    (result.stderr or result.stdout or "iverilog compilation failed").strip()
                )
            
            logger.info(f"Compiled successfully: {compiled}")
            
            # Step 2: Run simulation with vvp
            logger.info(f"Running simulation with vvp, output to {vcd_output}")
            sim_cmd = ["vvp", str(compiled)]
            logger.debug(f"Simulation command: {' '.join(sim_cmd)}")
            
            result = subprocess.run(
                sim_cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=str(work_dir)
            )
            
            if result.returncode != 0:
                logger.error(f"Simulation exited with code {result.returncode}")
                raise SimulationError((result.stderr or result.stdout or "vvp simulation failed").strip())
            
            # Check if VCD was generated
            if not vcd_output.exists():
                raise SimulationError(
                    f"Simulation completed but no VCD file generated at {vcd_output}"
                )
            
            logger.info(f"Simulation successful, VCD: {vcd_output}")
            return str(vcd_output)
            
        except subprocess.TimeoutExpired:
            raise SimulationError("Simulation timed out (exceeded 5 minutes)")
        except Exception as e:
            logger.error(f"Simulation error: {e}", exc_info=True)
            raise


# Global instance
simulation_service = SimulationService()
