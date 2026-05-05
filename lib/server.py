#!/usr/bin/env python3
"""MAW Server - FastAPI app serving dashboard and API."""

import os
import json
from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

MAW_DIR = Path(__file__).parent.parent.resolve()
STATIC_DIR = MAW_DIR / "static"

app = FastAPI(title="MAW Server", version="0.2.0")

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
