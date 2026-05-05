#!/usr/bin/env python3
"""SSE Broadcaster - Watch state.json and push changes to clients."""

import asyncio
import json
import time
import threading
from pathlib import Path
from typing import Callable
from sse_starlette.sse import EventSourceResponse
from starlette.requests import Request


class StateBroadcaster:
    def __init__(self, state_file: Path):
        self.state_file = state_file
        self.last_mtime = 0
        self.last_content = None
        self.clients: list[Callable] = []
        self._running = False
        self._thread = None

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._thread.start()

    def _watch_loop(self):
        while self._running:
            try:
                if self.state_file.exists():
                    mtime = self.state_file.stat().st_mtime
                    if mtime != self.last_mtime:
                        self.last_mtime = mtime
                        with open(self.state_file) as f:
                            content = json.load(f)
                        if content != self.last_content:
                            self.last_content = content
                            for client in self.clients:
                                try:
                                    client(content)
                                except Exception:
                                    pass
            except Exception:
                pass
            time.sleep(1)

    def add_client(self, callback: Callable):
        self.clients.append(callback)

    def remove_client(self, callback: Callable):
        if callback in self.clients:
            self.clients.remove(callback)

    async def event_generator(self, request: Request):
        queue = []

        def callback(data):
            queue.append(data)

        self.add_client(callback)
        # Send initial state
        if self.last_content:
            queue.append(self.last_content)
        try:
            while not await request.is_disconnected():
                if queue:
                    data = queue.pop(0)
                    yield {"event": "state", "data": json.dumps(data)}
                else:
                    await asyncio.sleep(0.5)
        finally:
            self.remove_client(callback)
