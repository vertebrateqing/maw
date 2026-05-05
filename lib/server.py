#!/usr/bin/env python3
"""MAW Server - FastAPI app serving dashboard and API."""

import os
import json
from pathlib import Path
import subprocess

from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from lib.sse_broadcaster import StateBroadcaster
from lib.agent_runner import run_agent, kill_agent
from lib.auto_dispatcher import AutoDispatcher

MAW_DIR = Path(os.getcwd())
STATIC_DIR = Path(__file__).parent.parent.resolve() / "static"

app = FastAPI(title="MAW Server", version="0.2.1")

_dispatcher = None


def get_dispatcher():
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = AutoDispatcher(os.getcwd())
        _dispatcher.start()
    return _dispatcher


@app.on_event("startup")
async def startup_event():
    get_dispatcher()


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
        return {"agents": [], "pending_messages": []}
    with open(state_file) as f:
        return json.load(f)


@app.get("/api/messages")
async def api_messages():
    """Get all pending messages."""
    state_file = MAW_DIR / ".maw" / "state.json"
    if not state_file.exists():
        return []
    with open(state_file) as f:
        data = json.load(f)
    return data.get("pending_messages", [])


@app.post("/api/messages")
async def api_messages_create(request: Request):
    """Add a new message to the queue."""
    body = await request.json()
    content = body.get("content", "")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    result = subprocess.run(
        ["maw", "queue", content],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)
    return {"status": "queued", "id": result.stdout.strip()}


@app.put("/api/messages/{msg_id}")
async def api_messages_update(msg_id: str, request: Request):
    """Update a pending message."""
    body = await request.json()
    content = body.get("content", "")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    result = subprocess.run(
        ["maw", "queue-update", msg_id, content],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)
    return {"status": "updated", "id": msg_id}


@app.delete("/api/messages/{msg_id}")
async def api_messages_delete(msg_id: str):
    """Delete a pending message."""
    result = subprocess.run(
        ["maw", "queue-remove", msg_id],
        capture_output=True,
        text=True,
        cwd=os.getcwd(),
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)
    return {"status": "deleted", "id": msg_id}


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
