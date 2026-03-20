#!/usr/bin/env python3
"""
Unit tests for the backend that work without real FSDB files.
Uses mocking to test the API layer.

Usage:
    cd backend
    pip install pytest pytest-asyncio httpx
    pytest tests/ -v
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Mock the pynpi module before importing anything else
import sys
sys.modules['pynpi'] = MagicMock()
sys.modules['pynpi.npisys'] = MagicMock()
sys.modules['pynpi.wave'] = MagicMock()
sys.modules['pynpi.waveform'] = MagicMock()
sys.modules['pynpi.netlist'] = MagicMock()

from fastapi.testclient import TestClient


class MockAdapter:
    """Mock adapter for testing without NPI."""
    
    def __init__(self):
        self._wave_path = None
        self._design_path = None
    
    def open(self, wave_db, design_db=None):
        self._wave_path = wave_db
        self._design_path = design_db
        return True
    
    def close(self):
        self._wave_path = None
        self._design_path = None
    
    def get_info(self):
        from adapters.base import DatabaseInfo
        return DatabaseInfo(
            file_path=self._wave_path or "",
            time_unit="ns",
            min_time=0,
            max_time=30000,
            version="1.0",
            is_completed=True
        )
    
    def get_top_scopes(self):
        from adapters.base import ScopeInfo, ScopeType
        return [
            ScopeInfo(
                path="tb_counter",
                name="tb_counter",
                scope_type=ScopeType.MODULE,
                def_name="tb_counter",
                has_children=True,
                has_signals=True
            )
        ]
    
    def get_child_scopes(self, scope_path):
        from adapters.base import ScopeInfo, ScopeType
        if scope_path == "tb_counter":
            return [
                ScopeInfo(
                    path="tb_counter.dut",
                    name="dut",
                    scope_type=ScopeType.MODULE,
                    def_name="counter_top",
                    has_children=True,
                    has_signals=True
                )
            ]
        return []
    
    def get_scope_info(self, scope_path):
        for s in self.get_top_scopes():
            if s.path == scope_path:
                return s
        for s in self.get_child_scopes("tb_counter"):
            if s.path == scope_path:
                return s
        return None
    
    def get_signals(self, scope_path):
        from adapters.base import SignalInfo, SignalDirection
        if scope_path == "tb_counter":
            return [
                SignalInfo(
                    path="tb_counter.clk",
                    name="clk",
                    width=1,
                    left_range=0,
                    right_range=0,
                    direction=SignalDirection.NONE,
                    is_real=False
                ),
                SignalInfo(
                    path="tb_counter.rst_n",
                    name="rst_n",
                    width=1,
                    left_range=0,
                    right_range=0,
                    direction=SignalDirection.NONE,
                    is_real=False
                ),
                SignalInfo(
                    path="tb_counter.count_out",
                    name="count_out",
                    width=8,
                    left_range=7,
                    right_range=0,
                    direction=SignalDirection.NONE,
                    is_real=False
                ),
            ]
        return []
    
    def get_signal_info(self, signal_path):
        for s in self.get_signals("tb_counter"):
            if s.path == signal_path:
                return s
        return None
    
    def search_signals(self, pattern, scope_path=None, limit=100):
        all_signals = self.get_signals("tb_counter")
        pattern_lower = pattern.lower().replace("*", "")
        return [s for s in all_signals if pattern_lower in s.name.lower()][:limit]
    
    def get_waveform(self, signal_path, start_time, end_time, max_changes=10000):
        from adapters.base import WaveformData, ValueChange
        return WaveformData(
            signal_path=signal_path,
            start_time=start_time,
            end_time=end_time,
            time_unit="ns",
            changes=[
                ValueChange(time=0, value="0"),
                ValueChange(time=5, value="1"),
                ValueChange(time=10, value="0"),
                ValueChange(time=15, value="1"),
            ]
        )
    
    def get_value_at_time(self, signal_path, time):
        return "1" if time % 10 >= 5 else "0"
    
    def get_waveforms_batch(self, signal_paths, start_time, end_time, max_changes=10000):
        return {
            path: self.get_waveform(path, start_time, end_time, max_changes)
            for path in signal_paths
        }


@pytest.fixture
def mock_adapter():
    """Fixture that patches get_adapter to return MockAdapter."""
    with patch('app.services.session_manager.get_adapter') as mock_get:
        mock_get.return_value = MockAdapter()
        yield mock_get


@pytest.fixture
def client(mock_adapter):
    """Create test client with mocked adapter."""
    from app.main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestSessionEndpoints:
    def test_create_session(self, client):
        response = client.post("/api/sessions", json={
            "vendor": "verdi",
            "wave_db": "/path/to/waves.fsdb"
        })
        assert response.status_code == 201
        data = response.json()
        assert "session" in data
        assert data["session"]["wave_db"] == "/path/to/waves.fsdb"
        assert data["session"]["min_time"] == 0
        assert data["session"]["max_time"] == 30000
    
    def test_list_sessions(self, client):
        # Create a session first
        client.post("/api/sessions", json={
            "vendor": "verdi",
            "wave_db": "/path/to/waves.fsdb"
        })
        
        response = client.get("/api/sessions")
        assert response.status_code == 200
        assert len(response.json()["sessions"]) >= 1
    
    def test_close_session(self, client):
        # Create session
        resp = client.post("/api/sessions", json={
            "vendor": "verdi",
            "wave_db": "/path/to/waves.fsdb"
        })
        session_id = resp.json()["session"]["id"]
        
        # Close it
        response = client.delete(f"/api/sessions/{session_id}")
        assert response.status_code == 204


class TestHierarchyEndpoints:
    @pytest.fixture
    def session_id(self, client):
        resp = client.post("/api/sessions", json={
            "vendor": "verdi",
            "wave_db": "/path/to/waves.fsdb"
        })
        return resp.json()["session"]["id"]
    
    def test_get_top_scopes(self, client, session_id):
        response = client.get(f"/api/hierarchy/{session_id}/scopes")
        assert response.status_code == 200
        scopes = response.json()["scopes"]
        assert len(scopes) == 1
        assert scopes[0]["path"] == "tb_counter"
    
    def test_get_child_scopes(self, client, session_id):
        response = client.get(f"/api/hierarchy/{session_id}/scopes/tb_counter/children")
        assert response.status_code == 200
        scopes = response.json()["scopes"]
        assert len(scopes) == 1
        assert scopes[0]["name"] == "dut"
    
    def test_get_signals(self, client, session_id):
        response = client.get(f"/api/hierarchy/{session_id}/scopes/tb_counter/signals")
        assert response.status_code == 200
        signals = response.json()["signals"]
        assert len(signals) == 3
        names = [s["name"] for s in signals]
        assert "clk" in names
        assert "count_out" in names
    
    def test_search_signals(self, client, session_id):
        response = client.post(f"/api/hierarchy/{session_id}/signals/search", json={
            "pattern": "*clk*",
            "limit": 10
        })
        assert response.status_code == 200
        signals = response.json()["signals"]
        assert len(signals) >= 1
        assert any("clk" in s["name"] for s in signals)


class TestWaveformEndpoints:
    @pytest.fixture
    def session_id(self, client):
        resp = client.post("/api/sessions", json={
            "vendor": "verdi",
            "wave_db": "/path/to/waves.fsdb"
        })
        return resp.json()["session"]["id"]
    
    def test_get_waveform(self, client, session_id):
        response = client.get(
            f"/api/waveform/{session_id}/signals/tb_counter.clk",
            params={"start": 0, "end": 100}
        )
        assert response.status_code == 200
        wf = response.json()["waveform"]
        assert wf["signal_path"] == "tb_counter.clk"
        assert wf["start_time"] == 0
        assert wf["end_time"] == 100
        assert len(wf["changes"]) > 0
    
    def test_get_value_at_time(self, client, session_id):
        response = client.get(
            f"/api/waveform/{session_id}/value/tb_counter.clk",
            params={"time": 7}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["signal_path"] == "tb_counter.clk"
        assert data["time"] == 7
        assert data["value"] in ["0", "1"]
    
    def test_batch_waveforms(self, client, session_id):
        response = client.post(f"/api/waveform/{session_id}/batch", json={
            "signal_paths": ["tb_counter.clk", "tb_counter.rst_n"],
            "start_time": 0,
            "end_time": 100
        })
        assert response.status_code == 200
        waveforms = response.json()["waveforms"]
        assert "tb_counter.clk" in waveforms
        assert "tb_counter.rst_n" in waveforms


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
