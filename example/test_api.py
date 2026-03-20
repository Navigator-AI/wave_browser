#!/usr/bin/env python3
"""
Test the FastAPI backend using HTTP requests (no frontend needed).

Usage:
    # First start the backend server:
    cd backend && uvicorn app.main:app --reload --port 8000
    
    # Then run this script:
    python test_api.py /path/to/waves.fsdb [/path/to/design.kdb]
"""

import sys
import os
import json
import requests

BASE_URL = "http://localhost:8000"


def pretty_print(data):
    print(json.dumps(data, indent=2))


def test_api(wave_db: str, design_db: str = None):
    """Test the API endpoints."""
    
    print("=" * 60)
    print("Wave Browser - API Test")
    print("=" * 60)
    print(f"API URL: {BASE_URL}")
    print()
    
    # Health check
    print("-" * 60)
    print("1. Health Check")
    print("-" * 60)
    resp = requests.get(f"{BASE_URL}/health")
    print(f"Status: {resp.status_code}")
    pretty_print(resp.json())
    print()
    
    # Create session
    print("-" * 60)
    print("2. Create Session (Open Database)")
    print("-" * 60)
    session_data = {
        "vendor": "verdi",
        "wave_db": wave_db,
    }
    if design_db:
        session_data["design_db"] = design_db
    
    resp = requests.post(f"{BASE_URL}/api/sessions", json=session_data)
    print(f"Status: {resp.status_code}")
    if resp.status_code != 201:
        print(f"Error: {resp.text}")
        return
    
    session = resp.json()["session"]
    session_id = session["id"]
    pretty_print(session)
    print()
    
    # List sessions
    print("-" * 60)
    print("3. List Sessions")
    print("-" * 60)
    resp = requests.get(f"{BASE_URL}/api/sessions")
    print(f"Status: {resp.status_code}")
    print(f"Active sessions: {len(resp.json()['sessions'])}")
    print()
    
    # Get top scopes
    print("-" * 60)
    print("4. Get Top Scopes")
    print("-" * 60)
    resp = requests.get(f"{BASE_URL}/api/hierarchy/{session_id}/scopes")
    print(f"Status: {resp.status_code}")
    scopes = resp.json()["scopes"]
    for scope in scopes:
        print(f"  {scope['path']} ({scope['scope_type']})")
    print()
    
    if scopes:
        top_scope = scopes[0]["path"]
        
        # Get child scopes
        print("-" * 60)
        print(f"5. Get Child Scopes of '{top_scope}'")
        print("-" * 60)
        resp = requests.get(f"{BASE_URL}/api/hierarchy/{session_id}/scopes/{top_scope}/children")
        print(f"Status: {resp.status_code}")
        children = resp.json()["scopes"]
        for child in children:
            print(f"  {child['path']} ({child['scope_type']})")
        print()
        
        # Get signals
        print("-" * 60)
        print(f"6. Get Signals in '{top_scope}'")
        print("-" * 60)
        resp = requests.get(f"{BASE_URL}/api/hierarchy/{session_id}/scopes/{top_scope}/signals")
        print(f"Status: {resp.status_code}")
        signals = resp.json()["signals"]
        for sig in signals[:10]:
            width = f"[{sig['left_range']}:{sig['right_range']}]" if sig['width'] > 1 else ""
            print(f"  {sig['name']}{width}")
        if len(signals) > 10:
            print(f"  ... and {len(signals) - 10} more")
        print()
        
        # Search signals
        print("-" * 60)
        print("7. Search Signals (pattern: '*count*')")
        print("-" * 60)
        resp = requests.post(
            f"{BASE_URL}/api/hierarchy/{session_id}/signals/search",
            json={"pattern": "*count*", "limit": 10}
        )
        print(f"Status: {resp.status_code}")
        results = resp.json()["signals"]
        for sig in results:
            print(f"  {sig['path']}")
        print()
        
        # Get waveform
        if signals:
            sig_path = signals[0]["path"]
            print("-" * 60)
            print(f"8. Get Waveform for '{sig_path}'")
            print("-" * 60)
            
            start = session["min_time"]
            end = min(session["max_time"], start + 1000)
            
            resp = requests.get(
                f"{BASE_URL}/api/waveform/{session_id}/signals/{sig_path}",
                params={"start": start, "end": end, "max_changes": 20}
            )
            print(f"Status: {resp.status_code}")
            wf = resp.json()["waveform"]
            print(f"Signal: {wf['signal_path']}")
            print(f"Time range: {wf['start_time']} - {wf['end_time']} {wf['time_unit']}")
            print(f"Value changes ({len(wf['changes'])}):")
            for change in wf["changes"][:10]:
                print(f"  {change['time']}: {change['value']}")
            print()
            
            # Get value at time
            print("-" * 60)
            print(f"9. Get Value at Time {(start + end) // 2}")
            print("-" * 60)
            mid_time = (start + end) // 2
            resp = requests.get(
                f"{BASE_URL}/api/waveform/{session_id}/value/{sig_path}",
                params={"time": mid_time}
            )
            print(f"Status: {resp.status_code}")
            pretty_print(resp.json())
            print()
    
    # Close session
    print("-" * 60)
    print("10. Close Session")
    print("-" * 60)
    resp = requests.delete(f"{BASE_URL}/api/sessions/{session_id}")
    print(f"Status: {resp.status_code}")
    print("Session closed" if resp.status_code == 204 else f"Error: {resp.text}")
    print()
    
    print("=" * 60)
    print("API Test Complete!")
    print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    wave_db = os.path.abspath(sys.argv[1])
    design_db = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else None
    
    try:
        test_api(wave_db, design_db)
    except requests.exceptions.ConnectionError:
        print("Error: Cannot connect to backend server")
        print("Make sure the server is running:")
        print("  cd backend && uvicorn app.main:app --reload --port 8000")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
