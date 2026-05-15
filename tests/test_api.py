#!/usr/bin/env python3
"""API tests for MAW FastAPI server."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure mawlib/ is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def mock_startup():
    """Prevent background threads from starting during tests."""
    with (
        patch("mawlib.server.get_dispatcher", return_value=MagicMock()),
        patch("mawlib.server.get_broadcaster", return_value=MagicMock()),
    ):
        yield


@pytest.fixture
def client(mock_startup):
    """Create a TestClient with mocked dependencies."""
    # Import app after patching startup
    from mawlib.server import app

    return TestClient(app)


class TestApiStatus:
    def test_status_no_state_file(self, client):
        with patch("mawlib.server.Path.exists", return_value=False):
            response = client.get("/api/status")
        assert response.status_code == 200
        data = response.json()
        assert data["agents"] == []
        assert data["pending_messages"] == []
        assert "cwd" in data

    def test_status_with_state(self, client, tmp_path):
        state = {"agents": [{"id": 1, "status": "idle"}], "pending_messages": []}
        state_file = tmp_path / ".maw" / "state.json"
        state_file.parent.mkdir(parents=True)
        state_file.write_text(json.dumps(state))
        with patch("mawlib.server.MAW_DIR", tmp_path):
            response = client.get("/api/status")
        assert response.status_code == 200
        data = response.json()
        assert len(data["agents"]) == 1
        assert data["agents"][0]["id"] == 1


class TestApiMessages:
    def test_get_messages_empty(self, client):
        with patch("mawlib.server.Path.exists", return_value=False):
            response = client.get("/api/messages")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_messages_with_data(self, client, tmp_path):
        state = {"pending_messages": [{"id": "msg-1", "content": "hello"}]}
        state_file = tmp_path / ".maw" / "state.json"
        state_file.parent.mkdir(parents=True)
        state_file.write_text(json.dumps(state))
        with patch("mawlib.server.MAW_DIR", tmp_path):
            response = client.get("/api/messages")
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["content"] == "hello"

    def test_create_message_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="msg-1\n", stderr="")
            response = client.post("/api/messages", json={"content": "test task"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert data["id"] == "msg-1"

    def test_create_message_missing_content(self, client):
        response = client.post("/api/messages", json={})
        assert response.status_code == 400

    def test_create_message_queue_failure(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="queue full")
            response = client.post("/api/messages", json={"content": "test"})
        assert response.status_code == 500

    def test_update_message_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            response = client.put("/api/messages/msg-1", json={"content": "updated"})
        assert response.status_code == 200
        assert response.json()["status"] == "updated"
        assert response.json()["id"] == "msg-1"

    def test_update_message_missing_content(self, client):
        response = client.put("/api/messages/msg-1", json={})
        assert response.status_code == 400

    def test_delete_message_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            response = client.delete("/api/messages/msg-1")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"


class TestApiDiff:
    def test_diff_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="+added line\n", stderr="")
            response = client.get("/api/diff/1")
        assert response.status_code == 200
        data = response.json()
        assert data["diff"] == "+added line\n"
        assert data["agent_id"] == 1


class TestApiApprove:
    def test_approve_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            response = client.post("/api/approve/1")
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert response.json()["agent_id"] == 1

    def test_approve_failure(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="merge conflict")
            response = client.post("/api/approve/1")
        assert response.status_code == 400


class TestApiReject:
    def test_reject_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            response = client.post("/api/reject/1")
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

    def test_reject_failure(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
            response = client.post("/api/reject/1")
        assert response.status_code == 500


class TestApiKill:
    def test_kill_success(self, client):
        with patch("mawlib.server.kill_agent") as mock_kill:
            response = client.post("/api/kill/1")
        assert response.status_code == 200
        assert response.json()["status"] == "killed"
        mock_kill.assert_called_once_with(1)


class TestApiLog:
    def test_log_not_found(self, client):
        with patch("mawlib.server.Path.exists", return_value=False):
            response = client.get("/api/log/1")
        assert response.status_code == 200
        assert response.json()["log"] == ""
        assert response.json()["agent_id"] == 1

    def test_log_with_content(self, client, tmp_path):
        log_file = tmp_path / ".maw" / "logs" / "agent-1.log"
        log_file.parent.mkdir(parents=True)
        log_file.write_text("line1\nline2\nline3\n")
        with patch("mawlib.server.MAW_DIR", tmp_path):
            with patch("mawlib.server.subprocess.run") as mock_run:
                mock_run.return_value = MagicMock(returncode=0, stdout="line2\nline3\n", stderr="")
                response = client.get("/api/log/1?lines=2")
        assert response.status_code == 200
        assert response.json()["log"] == "line2\nline3\n"


class TestApiAgentConfig:
    def test_config_success(self, client):
        with patch("mawlib.server.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            response = client.put(
                "/api/agents/1/config",
                json={"key": "model", "value": "opus"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        assert data["agent_id"] == 1
        assert data["key"] == "model"
        assert data["value"] == "opus"

    def test_config_missing_key(self, client):
        response = client.put("/api/agents/1/config", json={"value": "opus"})
        assert response.status_code == 400

    def test_config_missing_value(self, client):
        response = client.put("/api/agents/1/config", json={"key": "model"})
        assert response.status_code == 400


class TestApiDispatch:
    def test_dispatch_success(self, client):
        mock_proc = MagicMock()
        mock_proc.pid = 12345
        with patch("mawlib.server.run_agent", return_value=mock_proc) as mock_run:
            response = client.post("/api/dispatch?agent_id=1&task=hello")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dispatched"
        assert data["agent_id"] == 1
        assert data["pid"] == 12345
        mock_run.assert_called_once()
        assert mock_run.call_args[0][0] == 1
        assert mock_run.call_args[0][1] == "hello"
