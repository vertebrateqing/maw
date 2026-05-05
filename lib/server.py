#!/usr/bin/env python3
"""MAW Server - FastAPI app serving dashboard and API."""

import os
import json
from pathlib import Path
import subprocess

from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from lib.pty_bridge import PtyBridge
from lib.sse_broadcaster import StateBroadcaster
from lib.agent_runner import run_agent, kill_agent

MAW_DIR = Path(__file__).parent.parent.resolve()
STATIC_DIR = MAW_DIR / "static"

app = FastAPI(title="MAW Server", version="0.2.0")

# Global bridge instance (initialized on first connection)
_bridge = None


def get_bridge():
    global _bridge
    if _bridge is None:
        _bridge = PtyBridge(["claude"], cwd=str(os.getcwd()))
        _bridge.start()
    return _bridge


broadcaster = None


def get_broadcaster():
    global broadcaster
    if broadcaster is None:
        broadcaster = StateBroadcaster(MAW_DIR / ".maw" / "state.json")
        broadcaster.start()
    return broadcaster


# Serve static files (React build output)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/status")
async def api_status():
    state_file = MAW_DIR / ".maw" / "state.json"
    if not state_file.exists():
        return {"agents": []}
    with open(state_file) as f:
        return json.load(f)


@app.websocket("/ws/master")
async def ws_master(websocket: WebSocket):
    await websocket.accept()
    bridge = get_bridge()

    async def send_to_client(text: str):
        try:
            await websocket.send_text(text)
        except Exception:
            pass

    bridge.add_client(send_to_client)
    try:
        while True:
            data = await websocket.receive_text()
            bridge.write(data)
    except Exception:
        pass
    finally:
        bridge.remove_client(send_to_client)


@app.get("/api/events")
async def api_events(request: Request):
    bc = get_broadcaster()
    return EventSourceResponse(bc.event_generator(request))


@app.post("/api/dispatch")
async def api_dispatch(agent_id: int, task: str):
    """Dispatch a task to an agent."""
    proc = run_agent(agent_id, task, str(os.getcwd()))
    return {"status": "dispatched", "agent_id": agent_id, "pid": proc.pid}


@app.get("/api/diff/{agent_id}")
async def api_diff(agent_id: int):
    """Get git diff for an agent branch."""
    result = subprocess.run(
        ["git", "diff", f"main...agent/{agent_id}"],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    return {"diff": result.stdout, "agent_id": agent_id}


@app.post("/api/approve/{agent_id}")
async def api_approve(agent_id: int):
    """Approve and merge an agent."""
    result = subprocess.run(
        ["maw", "approve", str(agent_id)],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    if result.returncode != 0:
        raise HTTPException(status_code=400, detail=result.stderr)
    return {"status": "approved", "agent_id": agent_id}


@app.post("/api/reject/{agent_id}")
async def api_reject(agent_id: int):
    """Reject an agent."""
    result = subprocess.run(
        ["maw", "reject", str(agent_id)],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    return {"status": "rejected", "agent_id": agent_id}


@app.post("/api/kill/{agent_id}")
async def api_kill(agent_id: int):
    """Kill an agent subprocess."""
    kill_agent(agent_id)
    return {"status": "killed", "agent_id": agent_id}


@app.get("/api/log/{agent_id}")
async def api_log(agent_id: int, lines: int = 50):
    """Get last N lines of agent log."""
    log_file = MAW_DIR / ".maw" / "logs" / f"agent-{agent_id}.log"
    if not log_file.exists():
        return {"log": "", "agent_id": agent_id}
    result = subprocess.run(
        ["tail", "-n", str(lines), str(log_file)],
        capture_output=True,
        text=True,
    )
    return {"log": result.stdout, "agent_id": agent_id}
