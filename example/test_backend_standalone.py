#!/usr/bin/env python3
"""
Standalone backend test script - tests NPI adapter without frontend.

Usage:
    source ../setup_env.sh
    python test_backend_standalone.py /path/to/waves.fsdb [/path/to/design.kdb]

Example:
    python test_backend_standalone.py sim/waves.fsdb sim/simv.daidir/kdb.elab++
"""

import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from adapters import VerdiAdapter, get_adapter


def print_json(obj):
    """Pretty print an object as JSON."""
    if hasattr(obj, '__dict__'):
        print(json.dumps(obj.__dict__, indent=2, default=str))
    else:
        print(json.dumps(obj, indent=2, default=str))


def test_adapter(wave_db: str, design_db: str = None):
    """Test the Verdi adapter with the given database files."""
    
    print("=" * 60)
    print("Wave Browser - Backend Standalone Test")
    print("=" * 60)
    print(f"Wave DB:   {wave_db}")
    print(f"Design DB: {design_db or 'Not provided'}")
    print()
    
    # Create adapter
    print("Creating Verdi adapter...")
    adapter = get_adapter("verdi")
    
    # Open database
    print("Opening database...")
    adapter.open(wave_db, design_db)
    print("Database opened successfully!")
    print()
    
    # Get database info
    print("-" * 60)
    print("DATABASE INFO:")
    print("-" * 60)
    info = adapter.get_info()
    print_json(info)
    print()
    
    # Get top scopes
    print("-" * 60)
    print("TOP-LEVEL SCOPES:")
    print("-" * 60)
    top_scopes = adapter.get_top_scopes()
    for scope in top_scopes:
        print(f"  {scope.path} ({scope.scope_type.value})")
        if scope.def_name:
            print(f"    def_name: {scope.def_name}")
        print(f"    has_children: {scope.has_children}, has_signals: {scope.has_signals}")
    print()
    
    # Navigate hierarchy
    if top_scopes:
        print("-" * 60)
        print("HIERARCHY NAVIGATION:")
        print("-" * 60)
        
        def print_hierarchy(scope_path, indent=0):
            prefix = "  " * indent
            child_scopes = adapter.get_child_scopes(scope_path)
            for child in child_scopes:
                print(f"{prefix}├─ {child.name} ({child.scope_type.value})")
                if child.has_children:
                    print_hierarchy(child.path, indent + 1)
        
        for scope in top_scopes:
            print(f"{scope.name} ({scope.scope_type.value})")
            print_hierarchy(scope.path, 1)
    print()
    
    # Get signals from first scope
    if top_scopes:
        print("-" * 60)
        print("SIGNALS IN TOP SCOPE:")
        print("-" * 60)
        scope_path = top_scopes[0].path
        signals = adapter.get_signals(scope_path)
        for sig in signals[:20]:  # Limit to first 20
            width_str = f"[{sig.left_range}:{sig.right_range}]" if sig.width > 1 else ""
            dir_str = sig.direction.value if sig.direction.value != "none" else ""
            print(f"  {sig.name}{width_str} {dir_str}")
        if len(signals) > 20:
            print(f"  ... and {len(signals) - 20} more signals")
    print()
    
    # Search for signals
    print("-" * 60)
    print("SIGNAL SEARCH (pattern: '*clk*'):")
    print("-" * 60)
    search_results = adapter.search_signals("*clk*", limit=10)
    for sig in search_results:
        print(f"  {sig.path}")
    if not search_results:
        print("  No signals found matching '*clk*'")
    print()
    
    # Get waveform data (only if we have FSDB)
    if top_scopes and wave_db:
        print("-" * 60)
        print("WAVEFORM DATA:")
        print("-" * 60)
        
        # Find a signal to get waveform for
        signals = adapter.get_signals(top_scopes[0].path)
        if signals:
            sig = signals[0]
            print(f"Getting waveform for: {sig.path}")
            print(f"Time range: {info.min_time} to {min(info.max_time, info.min_time + 1000)}")
            
            waveform = adapter.get_waveform(
                sig.path,
                info.min_time,
                min(info.max_time, info.min_time + 1000),
                max_changes=20
            )
            
            print(f"Got {len(waveform.changes)} value changes:")
            for change in waveform.changes[:10]:
                print(f"  {change.time}: {change.value}")
            if len(waveform.changes) > 10:
                print(f"  ... and {len(waveform.changes) - 10} more changes")
    elif not wave_db:
        print("-" * 60)
        print("WAVEFORM DATA: Skipped (no FSDB provided)")
        print("-" * 60)
    print()
    
    # Test value at specific time (only if we have FSDB)
    if top_scopes and wave_db:
        print("-" * 60)
        print("VALUE AT TIME:")
        print("-" * 60)
        signals = adapter.get_signals(top_scopes[0].path)
        if signals:
            sig = signals[0]
            mid_time = (info.min_time + info.max_time) // 2
            value = adapter.get_value_at_time(sig.path, mid_time)
            print(f"Value of {sig.path} at time {mid_time}: {value}")
    elif not wave_db:
        print("-" * 60)
        print("VALUE AT TIME: Skipped (no FSDB provided)")
        print("-" * 60)
    print()
    
    # Close database
    print("-" * 60)
    print("Closing database...")
    adapter.close()
    print("Done!")
    print("=" * 60)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Test Wave Browser backend adapter")
    parser.add_argument("wave_db", nargs="?", help="Path to FSDB waveform file")
    parser.add_argument("--design-db", "-d", help="Path to KDB design database")
    parser.add_argument("--design-only", action="store_true", 
                        help="Test with design database only (no waveforms)")
    args = parser.parse_args()
    
    if args.design_only:
        if not args.design_db:
            parser.error("--design-db required with --design-only")
        wave_db = None
        design_db = args.design_db
    else:
        if not args.wave_db:
            parser.error("wave_db required (or use --design-only)")
        wave_db = args.wave_db
        design_db = args.design_db
    
    if wave_db and not os.path.exists(wave_db):
        print(f"Error: File not found: {wave_db}")
        sys.exit(1)
    
    # For design_db, check only if it's a single path (adapter handles multi-file lists)
    if design_db and ' ' not in design_db and not os.path.exists(design_db):
        print(f"Error: File not found: {design_db}")
        sys.exit(1)
    
    try:
        test_adapter(wave_db, design_db)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
