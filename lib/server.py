#!/usr/bin/env python3
"""MAW Server - FastAPI app serving dashboard and API."""

import os
import json
from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from lib.pty_bridge import PtyBridge

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
