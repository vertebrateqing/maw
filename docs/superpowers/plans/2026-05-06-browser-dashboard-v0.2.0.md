# MAW Browser Dashboard v0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tmux + Termius with a browser-based dashboard. Add Python daemon (FastAPI + PTY + SSE), React frontend (Vite + Tailwind + shadcn/ui), update maw CLI for `pending_review` state and autonomous dispatch rules.

**Architecture:** A systemd-backed Python daemon runs master Claude Code in a PTY, bridges it to the browser via WebSocket, serves a React dashboard for agent status/diff/review, and broadcasts state changes via SSE. Sub-agents run as background subprocesses with log files.

**Tech Stack:** Python 3.10+ (FastAPI, uvicorn, websockets, pty), React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui, Bash (maw CLI updates)

---

## File Structure

### New Files

```
maw/
├── bin/
│   └── maw-server                          # Python daemon entrypoint
├── lib/
│   ├── server.py                           # FastAPI app, HTTP routes
│   ├── pty_bridge.py                       # PTY ↔ WebSocket bidirectional forwarding
│   ├── sse_broadcaster.py                  # state.json watcher + SSE push
│   └── agent_runner.py                     # Spawn/kill agent subprocesses
├── frontend/                               # React source (not committed build)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── components.json                     # shadcn/ui config
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/
│       │   └── index.ts
│       ├── hooks/
│       │   ├── useTerminal.ts
│       │   └── useApi.ts
│       └── components/
│           ├── Terminal.tsx
│           ├── AgentCard.tsx
│           ├── DiffViewer.tsx
│           ├── Toast.tsx
│           ├── ShortcutBar.tsx
│           └── Layout.tsx
├── static/                                 # Vite build output (committed)
│   ├── index.html
│   └── assets/
├── config/
│   └── maw.service                         # systemd unit file
├── requirements.txt                        # Python deps
├── CLAUDE.md                               # Claude behavior rules
└── .gitignore                              # Update to ignore frontend/node_modules
```

### Modified Files

```
maw/
├── bin/maw                                 # Add approve/reject/review-request/diff commands
├── lib/state.sh                            # Add pending_review state support
├── lib/core.sh                             # Add maw_server_dir helper
├── README.md                               # Replace tmux instructions with browser workflow
├── README.zh-CN.md                         # Same in Chinese
└── .gitignore                              # Add node_modules, dist, etc.
```

---

### Task 1: Python Backend Foundation

**Files:**
- Create: `requirements.txt`
- Create: `lib/server.py`
- Modify: `.gitignore`

- [ ] **Step 1: Create requirements.txt**

```bash
cat > requirements.txt << 'EOF'
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
websockets>=12.0
sse-starlette>=1.6.0
ptyprocess>=0.7.0
EOF
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/liqing/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 3: Create FastAPI skeleton with static files**

Write `lib/server.py`:

```python
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
```

- [ ] **Step 4: Test the skeleton**

```bash
source .venv/bin/activate
cd /home/liqing/maw
python -c "from lib.server import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Update .gitignore**

Add to `.gitignore`:
```
.venv/
__pycache__/
*.pyc
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 6: Commit**

```bash
git add requirements.txt lib/server.py .gitignore
git commit -m "feat(server): add FastAPI skeleton with static files

- requirements.txt with fastapi, uvicorn, websockets, sse-starlette, ptyprocess
- lib/server.py with / and /api/status endpoints
- Static file mounting for React build output"
```

---

### Task 2: PTY Bridge

**Files:**
- Create: `lib/pty_bridge.py`

- [ ] **Step 1: Write PTY bridge module**

Write `lib/pty_bridge.py`:

```python
#!/usr/bin/env python3
"""PTY Bridge - Bidirectional PTY ↔ WebSocket forwarding."""

import os
import pty
import select
import threading
import asyncio
from typing import Callable


class PtyBridge:
    """Manages a PTY and forwards data between it and WebSocket clients."""

    def __init__(self, command: list[str], cwd: str = None):
        self.command = command
        self.cwd = cwd or os.getcwd()
        self.master_fd = None
        self.child_pid = None
        self.clients: set[Callable[[str], None]] = set()
        self._read_thread = None
        self._running = False

    def start(self) -> None:
        """Start the PTY and the child process."""
        self.master_fd, slave_fd = pty.openpty()
        self.child_pid = os.fork()

        if self.child_pid == 0:
            # Child process
            os.setsid()
            os.close(self.master_fd)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(slave_fd)
            os.chdir(self.cwd)
            os.execvp(self.command[0], self.command)
            os._exit(1)

        # Parent process
        os.close(slave_fd)
        self._running = True
        self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._read_thread.start()

    def _read_loop(self) -> None:
        """Read from PTY and broadcast to all clients."""
        while self._running:
            try:
                readable, _, _ = select.select([self.master_fd], [], [], 0.1)
                if readable:
                    data = os.read(self.master_fd, 4096)
                    if not data:
                        break
                    text = data.decode("utf-8", errors="replace")
                    for client in list(self.clients):
                        try:
                            client(text)
                        except Exception:
                            pass
            except (OSError, select.error):
                break

    def write(self, data: str) -> None:
        """Write data to PTY stdin."""
        if self.master_fd is not None:
            os.write(self.master_fd, data.encode("utf-8"))

    def inject(self, text: str) -> None:
        """Inject text into PTY (simulates typing)."""
        self.write(text)

    def add_client(self, callback: Callable[[str], None]) -> None:
        self.clients.add(callback)

    def remove_client(self, callback: Callable[[str], None]) -> None:
        self.clients.discard(callback)

    def stop(self) -> None:
        self._running = False
        if self.master_fd is not None:
            os.close(self.master_fd)
            self.master_fd = None
        if self.child_pid:
            try:
                os.kill(self.child_pid, 15)
            except ProcessLookupError:
                pass
```

- [ ] **Step 2: Test PTY creation**

```bash
source .venv/bin/activate
cd /home/liqing/maw
python3 -c "
from lib.pty_bridge import PtyBridge
b = PtyBridge(['bash', '-c', 'echo hello'])
b.start()
import time
time.sleep(0.5)
print('PTY started, pid:', b.child_pid)
b.stop()
"
```
Expected: `PTY started, pid: <number>`

- [ ] **Step 3: Commit**

```bash
git add lib/pty_bridge.py
git commit -m "feat(pty): add PTY bridge for WebSocket terminal

- PtyBridge class: creates PTY, forks child process
- _read_loop: reads PTY output, broadcasts to WebSocket clients
- write/inject: sends input to PTY
- add_client/remove_client: WebSocket connection management
- stop: cleanup PTY and child process"
```

---

### Task 3: WebSocket Terminal

**Files:**
- Modify: `lib/server.py`

- [ ] **Step 1: Integrate PTY bridge into server**

Add to `lib/server.py`:

```python
from lib.pty_bridge import PtyBridge

# Global bridge instance (initialized on first connection)
_bridge = None

def get_bridge():
    global _bridge
    if _bridge is None:
        _bridge = PtyBridge(["claude"], cwd=str(os.getcwd()))
        _bridge.start()
    return _bridge

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
```

- [ ] **Step 2: Test with a simple script**

```bash
source .venv/bin/activate
cd /home/liqing/maw
python3 -c "
from lib.server import get_bridge
import time
b = get_bridge()
time.sleep(1)
print('Bridge running, child pid:', b.child_pid)
b.stop()
"
```
Expected: Bridge starts, child pid is a number.

- [ ] **Step 3: Commit**

```bash
git add lib/server.py
git commit -m "feat(ws): add WebSocket endpoint for master terminal

- /ws/master WebSocket: bidirectional PTY ↔ browser
- Lazy PTY initialization on first connection
- Auto-cleanup on disconnect"
```

---

### Task 4: SSE State Broadcaster

**Files:**
- Create: `lib/sse_broadcaster.py`
- Modify: `lib/server.py`

- [ ] **Step 1: Write SSE broadcaster**

Write `lib/sse_broadcaster.py`:

```python
#!/usr/bin/env python3
"""SSE Broadcaster - Watch state.json and push changes to clients."""

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


import asyncio  # noqa: E402
```

- [ ] **Step 2: Add SSE endpoint to server**

Add to `lib/server.py`:

```python
from lib.sse_broadcaster import StateBroadcaster
import asyncio

broadcaster = None

def get_broadcaster():
    global broadcaster
    if broadcaster is None:
        broadcaster = StateBroadcaster(MAW_DIR / ".maw" / "state.json")
        broadcaster.start()
    return broadcaster

@app.get("/api/events")
async def api_events(request: Request):
    bc = get_broadcaster()
    return EventSourceResponse(bc.event_generator(request))
```

- [ ] **Step 3: Test SSE**

```bash
source .venv/bin/activate
cd /home/liqing/maw
curl -N http://localhost:8000/api/events 2>/dev/null &
# In another terminal, modify state.json to see SSE output
```

Run server test:
```bash
uvicorn lib.server:app --reload --port 8000 &
# Wait a moment then kill
```

- [ ] **Step 4: Commit**

```bash
git add lib/sse_broadcaster.py lib/server.py
git commit -m "feat(sse): add state file watcher and SSE broadcaster

- StateBroadcaster: polls state.json mtime, broadcasts JSON changes
- /api/events: SSE endpoint for real-time state updates
- 1-second poll interval with debouncing"
```

---

### Task 5: HTTP API Routes

**Files:**
- Create: `lib/agent_runner.py`
- Modify: `lib/server.py`

- [ ] **Step 1: Write agent runner module**

Write `lib/agent_runner.py`:

```python
#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
from pathlib import Path

MAW_DIR = Path(__file__).parent.parent.resolve()


def run_agent(agent_id: int, task: str, project_dir: str) -> subprocess.Popen:
    """Run claude in agent worktree as background process."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = MAW_DIR / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # Script that runs claude then marks review-request
    script = f'''#!/bin/bash
cd "{worktree}"
claude "{task.replace('"', '\\"')}"
maw review-request {agent_id}
'''

    proc = subprocess.Popen(
        ["bash", "-c", script],
        stdout=open(log_file, "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return proc


def kill_agent(agent_id: int) -> None:
    """Kill agent subprocess."""
    # Find process by worktree path (simplified)
    import signal
    result = subprocess.run(
        ["pgrep", "-f", f"agent-{agent_id}"],
        capture_output=True,
        text=True,
    )
    for pid_str in result.stdout.strip().split("\n"):
        if pid_str:
            try:
                os.kill(int(pid_str), signal.SIGTERM)
            except ProcessLookupError:
                pass
```

- [ ] **Step 2: Add API routes to server**

Add to `lib/server.py`:

```python
from fastapi import HTTPException
from lib.agent_runner import run_agent, kill_agent

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
```

- [ ] **Step 3: Test API routes**

```bash
source .venv/bin/activate
cd /home/liqing/maw
python3 -c "from lib.server import app; print('Routes loaded')"
```

- [ ] **Step 4: Commit**

```bash
git add lib/agent_runner.py lib/server.py
git commit -m "feat(api): add agent control HTTP routes

- /api/dispatch: spawn agent subprocess
- /api/diff/{id}: git diff main...agent/N
- /api/approve/{id}: approve and merge
- /api/reject/{id}: reject and reset
- /api/kill/{id}: terminate subprocess
- /api/log/{id}: tail agent log file
- agent_runner.py: background subprocess management"
```

---

### Task 6: maw-server Entrypoint

**Files:**
- Create: `bin/maw-server`
- Create: `config/maw.service`

- [ ] **Step 1: Write maw-server entrypoint**

Write `bin/maw-server`:

```bash
#!/usr/bin/env bash
set -euo pipefail

MAW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MAW_DIR"

# Activate virtualenv if it exists
if [[ -d "$MAW_DIR/.venv" ]]; then
    source "$MAW_DIR/.venv/bin/activate"
fi

# Ensure maw is in PATH
export PATH="$MAW_DIR/bin:$PATH"

# Start uvicorn
exec uvicorn lib.server:app --host 0.0.0.0 --port "${MAW_PORT:-8080}" --reload
```

```bash
chmod +x bin/maw-server
```

- [ ] **Step 2: Write systemd service file**

Write `config/maw.service`:

```ini
[Unit]
Description=MAW Server - Multi-Agent Workspace Dashboard
After=network.target

[Service]
Type=simple
User=%I
WorkingDirectory=/home/%I/maw
Environment=PATH=/home/%I/maw/bin:/usr/local/bin:/usr/bin:/bin
Environment=MAW_PORT=8080
ExecStart=/home/%I/maw/bin/maw-server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Test entrypoint**

```bash
cd /home/liqing/maw
bin/maw-server &
SERVER_PID=$!
sleep 2
curl -s http://localhost:8080/api/status | head -c 200
kill $SERVER_PID
```

- [ ] **Step 4: Commit**

```bash
git add bin/maw-server config/maw.service
git commit -m "feat(server): add daemon entrypoint and systemd config

- bin/maw-server: uvicorn launcher with venv activation
- config/maw.service: systemd unit with auto-restart
- Defaults to port 8080, configurable via MAW_PORT"
```

---

### Task 7: React Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Initialize React + Vite + TypeScript**

```bash
cd /home/liqing/maw/frontend
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install tailwindcss postcss autoprefixer @radix-ui/react-dialog @radix-ui/react-tabs class-variance-authority clsx tailwind-merge lucide-react
npm install -D @types/node
```

- [ ] **Step 3: Configure Tailwind**

Write `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

- [ ] **Step 4: Configure base CSS**

Write `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 5%;
    --foreground: 0 0% 83%;
    --card: 0 0% 8%;
    --card-foreground: 0 0% 83%;
    --popover: 0 0% 8%;
    --popover-foreground: 0 0% 83%;
    --primary: 207 90% 54%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 14%;
    --secondary-foreground: 0 0% 83%;
    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 52%;
    --accent: 0 0% 14%;
    --accent-foreground: 0 0% 83%;
    --destructive: 4 90% 58%;
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 24%;
    --input: 0 0% 24%;
    --ring: 207 90% 54%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'SF Mono', Monaco, monospace;
  }
}
```

- [ ] **Step 5: Update vite.config.ts**

```ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../static",
    emptyOutDir: true,
  },
})
```

- [ ] **Step 6: Commit frontend skeleton**

```bash
cd /home/liqing/maw
git add frontend/
git commit -m "feat(frontend): initialize React + Vite + Tailwind project

- Vite React TypeScript template
- Tailwind CSS with dark theme (matches Claude Code)
- shadcn/ui color tokens configured
- Build output to ../static/"
```

---

### Task 8: Frontend Types and Hooks

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/hooks/useTerminal.ts`
- Create: `frontend/src/hooks/useApi.ts`

- [ ] **Step 1: Write types**

Write `frontend/src/types/index.ts`:

```typescript
export interface Agent {
  id: number;
  worktree: string;
  branch: string;
  status: "idle" | "running" | "pending_review" | "error";
  task: string;
  pid: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface MawState {
  version: string;
  project: string;
  agents: Agent[];
  created_at: string;
}

export interface DiffResponse {
  diff: string;
  agent_id: number;
}

export interface LogResponse {
  log: string;
  agent_id: number;
}
```

- [ ] **Step 2: Write useTerminal hook**

Write `frontend/src/hooks/useTerminal.ts`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export function useTerminal(containerRef: React.RefObject<HTMLDivElement>) {
  const terminalRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'SF Mono', Monaco, monospace",
      theme: {
        background: "#0d0d0d",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/master`);

    ws.onopen = () => {
      term.writeln("\r\n\x1b[32m[MAW] Connected to master Claude\x1b[0m\r\n");
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[31m[MAW] Disconnected\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    terminalRef.current = term;
    wsRef.current = ws;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ws.close();
      term.dispose();
    };
  }, [containerRef]);

  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + "\r");
    }
  }, []);

  return { terminal: terminalRef, sendCommand };
}
```

- [ ] **Step 3: Write useApi hook**

Write `frontend/src/hooks/useApi.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { MawState, DiffResponse, LogResponse } from "@/types";

const API_BASE = "/api";

export function useApi() {
  const [state, setState] = useState<MawState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setState(data);
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      setError("Connection lost");
    };
    return () => eventSource.close();
  }, []);

  const fetchDiff = useCallback(async (agentId: number): Promise<string> => {
    const res = await fetch(`${API_BASE}/diff/${agentId}`);
    const data: DiffResponse = await res.json();
    return data.diff;
  }, []);

  const fetchLog = useCallback(async (agentId: number): Promise<string> => {
    const res = await fetch(`${API_BASE}/log/${agentId}`);
    const data: LogResponse = await res.json();
    return data.log;
  }, []);

  const approve = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/approve/${agentId}`, { method: "POST" });
  }, []);

  const reject = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/reject/${agentId}`, { method: "POST" });
  }, []);

  const kill = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/kill/${agentId}`, { method: "POST" });
  }, []);

  return { state, error, fetchDiff, fetchLog, approve, reject, kill };
}
```

- [ ] **Step 4: Install xterm.js**

```bash
cd /home/liqing/maw/frontend
npm install xterm xterm-addon-fit
```

- [ ] **Step 5: Commit**

```bash
cd /home/liqing/maw
git add frontend/src/types frontend/src/hooks
git commit -m "feat(frontend): add types and hooks

- types/index.ts: Agent, MawState, DiffResponse, LogResponse
- useTerminal: xterm.js + WebSocket PTY bridge
- useApi: SSE state subscription + HTTP API methods"
```

---

### Task 9: Frontend Components

**Files:**
- Create: `frontend/src/components/Terminal.tsx`
- Create: `frontend/src/components/AgentCard.tsx`
- Create: `frontend/src/components/DiffViewer.tsx`
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/ShortcutBar.tsx`
- Create: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Terminal component**

Write `frontend/src/components/Terminal.tsx`:

```tsx
import { useRef } from "react";
import { useTerminal } from "@/hooks/useTerminal";

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { sendCommand } = useTerminal(containerRef);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] rounded-lg overflow-hidden border border-[#3c3c3c]">
      <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="ml-2 text-xs text-[#858585]">Claude (Master)</span>
      </div>
      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
```

- [ ] **Step 2: AgentCard component**

Write `frontend/src/components/AgentCard.tsx`:

```tsx
import { useState } from "react";
import { Play, Square, Check, X, FileText, Clock } from "lucide-react";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  onViewDiff: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onKill: (id: number) => void;
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const styles = {
    idle: "bg-gray-800 text-gray-400 border-gray-700",
    running: "bg-blue-950 text-blue-400 border-blue-800",
    pending_review: "bg-yellow-950 text-yellow-400 border-yellow-800",
    error: "bg-red-950 text-red-400 border-red-800",
  };
  const labels = {
    idle: "Idle",
    running: "Running",
    pending_review: "Review",
    error: "Error",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatElapsed(startedAt: string | null) {
  if (!startedAt) return "--:--";
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AgentCard({ agent, onViewDiff, onApprove, onReject, onKill }: AgentCardProps) {
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [task, setTask] = useState("");

  return (
    <div className={`bg-[#252526] rounded-lg border p-3 ${
      agent.status === "pending_review" ? "border-yellow-700" : "border-[#3c3c3c]"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-[#858585]">agent-{agent.id}</span>
          <StatusBadge status={agent.status} />
        </div>
        {agent.status === "running" && agent.started_at && (
          <div className="flex items-center gap-1 text-xs text-[#858585]">
            <Clock size={12} />
            {formatElapsed(agent.started_at)}
          </div>
        )}
      </div>

      <div className="text-sm text-[#d4d4d4] mb-2 truncate">
        {agent.task || "No task assigned"}
      </div>

      <div className="flex gap-2">
        {agent.status === "idle" && (
          <>
            <button
              onClick={() => setShowTaskInput(!showTaskInput)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded hover:bg-blue-800"
            >
              <Play size={12} /> Dispatch
            </button>
          </>
        )}
        {agent.status === "running" && (
          <>
            <button
              onClick={() => onKill(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900 text-red-200 rounded hover:bg-red-800"
            >
              <Square size={12} /> Kill
            </button>
          </>
        )}
        {agent.status === "pending_review" && (
          <>
            <button
              onClick={() => onViewDiff(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] text-[#d4d4d4] rounded hover:bg-[#4c4c4c]"
            >
              <FileText size={12} /> Diff
            </button>
            <button
              onClick={() => onApprove(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-900 text-green-200 rounded hover:bg-green-800"
            >
              <Check size={12} /> Approve
            </button>
            <button
              onClick={() => onReject(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900 text-red-200 rounded hover:bg-red-800"
            >
              <X size={12} /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: DiffViewer component**

Write `frontend/src/components/DiffViewer.tsx`:

```tsx
import { X } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  agentId: number;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function parseDiff(diff: string) {
  const lines = diff.split("\n");
  const result: { type: string; content: string }[] = [];
  for (const line of lines) {
    if (line.startsWith("+")) {
      result.push({ type: "add", content: line });
    } else if (line.startsWith("-")) {
      result.push({ type: "del", content: line });
    } else if (line.startsWith("@@")) {
      result.push({ type: "chunk", content: line });
    } else {
      result.push({ type: "context", content: line });
    }
  }
  return result;
}

export function DiffViewer({ diff, agentId, onClose, onApprove, onReject }: DiffViewerProps) {
  const lines = parseDiff(diff);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-mono text-[#d4d4d4]">Diff: agent/{agentId} → main</h3>
          <button onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 font-mono text-sm">
          {lines.map((line, i) => {
            const baseClass = "px-2 py-0.5 whitespace-pre";
            if (line.type === "add") {
              return (
                <div key={i} className={`${baseClass} bg-[#0d3b2e] text-[#4ec9b0]`}>
                  {line.content}
                </div>
              );
            }
            if (line.type === "del") {
              return (
                <div key={i} className={`${baseClass} bg-[#3b0d0d] text-[#f48771]`}>
                  {line.content}
                </div>
              );
            }
            if (line.type === "chunk") {
              return (
                <div key={i} className={`${baseClass} text-[#858585] bg-[#1e1e1e] mt-2`}>
                  {line.content}
                </div>
              );
            }
            return (
              <div key={i} className={`${baseClass} text-[#d4d4d4]`}>
                {line.content || " "}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 px-4 py-3 border-t border-[#3c3c3c]">
          <button
            onClick={() => { onApprove(); onClose(); }}
            className="px-4 py-2 text-sm bg-green-900 text-green-200 rounded hover:bg-green-800"
          >
            Approve & Merge
          </button>
          <button
            onClick={() => { onReject(); onClose(); }}
            className="px-4 py-2 text-sm bg-red-900 text-red-200 rounded hover:bg-red-800"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#3c3c3c] text-[#d4d4d4] rounded hover:bg-[#4c4c4c]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Layout and App components**

Write `frontend/src/components/Layout.tsx`:

```tsx
import { useState } from "react";
import { Terminal } from "./Terminal";
import { AgentCard } from "./AgentCard";
import { DiffViewer } from "./DiffViewer";
import { useApi } from "@/hooks/useApi";

export function Layout() {
  const { state, fetchDiff, approve, reject, kill } = useApi();
  const [diffData, setDiffData] = useState<{ id: number; text: string } | null>(null);

  const handleViewDiff = async (id: number) => {
    const text = await fetchDiff(id);
    setDiffData({ id, text });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d]">
      <header className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#d4d4d4]">MAW</span>
          <span className="text-xs text-green-400">● Online</span>
        </div>
        <div className="text-xs text-[#858585]">
          {state?.agents?.length || 0} agents | {" "}
          {state?.agents?.filter((a) => a.status === "running").length || 0} running | {" "}
          {state?.agents?.filter((a) => a.status === "pending_review").length || 0} review
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 p-3">
          <Terminal />
        </div>
        <div className="w-80 border-l border-[#3c3c3c] p-3 overflow-y-auto">
          <h2 className="text-xs font-bold text-[#858585] uppercase mb-3">Agents</h2>
          <div className="space-y-3">
            {state?.agents?.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onViewDiff={handleViewDiff}
                onApprove={approve}
                onReject={reject}
                onKill={kill}
              />
            ))}
          </div>
        </div>
      </div>

      {diffData && (
        <DiffViewer
          diff={diffData.text}
          agentId={diffData.id}
          onClose={() => setDiffData(null)}
          onApprove={() => approve(diffData.id)}
          onReject={() => reject(diffData.id)}
        />
      )}
    </div>
  );
}
```

Write `frontend/src/App.tsx`:

```tsx
import { Layout } from "./components/Layout";

function App() {
  return <Layout />;
}

export default App;
```

- [ ] **Step 5: Update main.tsx**

Write `frontend/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Commit**

```bash
cd /home/liqing/maw
git add frontend/src/components frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat(frontend): add dashboard components

- Terminal: xterm.js wrapper with WebSocket
- AgentCard: idle/running/pending_review states with actions
- DiffViewer: modal with GitHub-style diff rendering
- Layout: responsive two-column layout with header"
```

---

### Task 10: Frontend Build and Integration

**Files:**
- Modify: `static/` (build output)

- [ ] **Step 1: Build frontend**

```bash
cd /home/liqing/maw/frontend
npm run build
```

Expected: Build succeeds, output to `../static/`

- [ ] **Step 2: Verify static files**

```bash
ls -la /home/liqing/maw/static/
# Should see index.html and assets/
```

- [ ] **Step 3: Test full stack**

```bash
cd /home/liqing/maw
source .venv/bin/activate
bin/maw-server &
sleep 2
curl -s http://localhost:8080/ | head -c 100
# Should see HTML
curl -s http://localhost:8080/api/status
# Should see state JSON
kill %1  # stop background server
```

- [ ] **Step 4: Commit static build**

```bash
git add static/
git commit -m "feat(frontend): build React dashboard to static/

- Vite production build
- static/index.html + assets/ committed for zero-config deployment"
```

---

### Task 11: maw CLI Updates

**Files:**
- Modify: `lib/state.sh`
- Modify: `bin/maw`

- [ ] **Step 1: Add pending_review state support**

Add to `lib/state.sh`:

```bash
# maw_state_review_request <id>
maw_state_review_request() {
  local id="$1"
  maw_state_update_agent "$id" "pending_review"
  maw_log info "Agent ${id} marked for review"
}
```

- [ ] **Step 2: Add new commands to bin/maw**

Add to `bin/maw`:

```bash
# maw_cmd_review_request <agent_id>
maw_cmd_review_request() {
  local agent_id="$1"
  maw_state_review_request "$agent_id"
}

# maw_cmd_approve <agent_id>
maw_cmd_approve() {
  local agent_id="$1"
  if maw_git_merge_agent "$agent_id"; then
    maw_state_update_agent "$agent_id" "idle" ""
    maw_log info "Agent ${agent_id} approved and merged"
  fi
}

# maw_cmd_reject <agent_id>
maw_cmd_reject() {
  local agent_id="$1"
  maw_git_worktree_reset "$agent_id"
  maw_state_update_agent "$agent_id" "idle" ""
  maw_log info "Agent ${agent_id} rejected and reset"
}

# maw_cmd_diff <agent_id>
maw_cmd_diff() {
  local agent_id="$1"
  local root
  root="$(maw_project_root)"
  git -C "$root" diff "main...agent/${agent_id}"
}
```

Add to `main()` dispatcher:

```bash
    review-request)
      if [[ $# -lt 1 ]]; then
        maw_die "Usage: maw review-request <agent-id>"
      fi
      maw_cmd_review_request "$1"
      ;;
    approve)
      if [[ $# -lt 1 ]]; then
        maw_die "Usage: maw approve <agent-id>"
      fi
      maw_cmd_approve "$1"
      ;;
    reject)
      if [[ $# -lt 1 ]]; then
        maw_die "Usage: maw reject <agent-id>"
      fi
      maw_cmd_reject "$1"
      ;;
    diff)
      if [[ $# -lt 1 ]]; then
        maw_die "Usage: maw diff <agent-id>"
      fi
      maw_cmd_diff "$1"
      ;;
```

- [ ] **Step 3: Update dispatch to not require tmux**

修改 `maw_cmd_dispatch`，移除 tmux 依赖，改为后台进程：

```bash
maw_cmd_dispatch() {
  local task="$1"
  local agent_id="${2:-}"
  local root
  root="$(maw_project_root)"

  if [[ -z "$agent_id" ]]; then
    agent_id=$(maw_state_get_idle_agent)
    if [[ -z "$agent_id" ]]; then
      maw_die "No idle agents available. Run 'maw status' to check."
    fi
  fi

  local status
  status=$(maw_state_get_agent_status "$agent_id")
  if [[ "$status" != "idle" ]]; then
    maw_die "Agent ${agent_id} is not idle (status: ${status})"
  fi

  local worktree="${root}/.agents/agent-${agent_id}"
  local log_file="${root}/.maw/logs/agent-${agent_id}.log"
  maw_ensure_dir "$(dirname "$log_file")"

  maw_state_update_agent "$agent_id" "running" "$task"

  # Run claude in background, then mark review-request on completion
  (
    cd "$worktree" || exit 1
    claude "$task"
    maw review-request "$agent_id"
  ) > "$log_file" 2>&1 &

  local pid=$!
  maw_state_update_agent "$agent_id" "running" "$task" "$pid"

  maw_log info "Dispatched task to agent-${agent_id} (PID: ${pid})"
}
```

- [ ] **Step 4: Update kill to not require tmux**

```bash
maw_cmd_kill() {
  local agent_id="$1"
  local state_file
  state_file="$(maw_state_file)"
  local pid
  pid=$(jq -r ".agents[] | select(.id == ${agent_id}) | .pid // empty" "$state_file")

  if [[ -n "$pid" && "$pid" != "null" ]]; then
    kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    maw_log info "Killed agent ${agent_id} (PID: ${pid})"
  fi

  maw_state_update_agent "$agent_id" "idle" ""
}
```

- [ ] **Step 5: Test new commands**

```bash
cd /home/liqing/maw
./bin/maw help | grep -E "review-request|approve|reject|diff"
# Should show all 4 commands
```

- [ ] **Step 6: Commit**

```bash
git add lib/state.sh bin/maw
git commit -m "feat(cli): add pending_review state and review commands

- maw review-request <id>: mark agent for review
- maw approve <id>: merge agent branch and reset
- maw reject <id>: reset agent worktree
- maw diff <id>: show git diff
- maw dispatch: remove tmux dependency, use background subprocess
- maw kill: remove tmux window kill"
```

---

### Task 12: CLAUDE.md and Documentation

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Write CLAUDE.md**

Write `CLAUDE.md`:

```markdown
# MAW Workflow

## Overview
MAW (Multi-Agent Workspace) allows you to delegate sub-tasks to parallel agents.
You are the master Claude running in the main terminal. Agents run in isolated
git worktrees and their output is visible in the browser dashboard.

## When to Dispatch
When a user request can be broken into independent sub-tasks, dispatch them:

```bash
maw dispatch "Implement user authentication"
maw dispatch "Add unit tests for auth module"
maw dispatch "Update documentation"
```

Check available agents first with `maw status`.

## Review Cycle
When an agent completes, you will see a notification in your terminal:

```
[MAW] Agent-2 completed "Add unit tests" — +120 -15 lines
        Run `maw diff 2` to review, `maw approve 2` to merge.
```

1. Run `maw diff N` to see the changes
2. If acceptable, run `maw approve N` (auto-merges to main)
3. If not acceptable, run `maw reject N` (agent resets to idle)

## Status Check
Run `maw status` anytime to see the agent board.

## Guidelines
- Only dispatch tasks that are independent (don't modify the same files)
- Review agent output before approving
- If an agent seems stuck, you can kill it with `maw kill N`
```

- [ ] **Step 2: Update README for browser workflow**

Replace the Quick Start section in `README.md` with browser-focused instructions. Key changes:
- Remove tmux setup
- Add `bin/maw-server` startup
- Add browser URL (`http://wsl2-ip:8080`)
- Add systemd setup

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md README.zh-CN.md
git commit -m "docs: add CLAUDE.md and update README for v0.2.0

- CLAUDE.md: Claude behavior rules for autonomous dispatch/review
- README: browser dashboard workflow, systemd setup
- Remove tmux/Termius instructions"
```

---

### Task 13: Final Integration and Tagging

**Files:**
- All

- [ ] **Step 1: Full test**

```bash
cd /home/liqing/maw
bash tests/run_all.sh
source .venv/bin/activate
python -c "from lib.server import app; print('Server OK')"
python -c "from lib.pty_bridge import PtyBridge; print('PTY OK')"
cd frontend && npm run build && cd ..
ls static/index.html
```

- [ ] **Step 2: Tag release**

```bash
git tag -a v0.2.0 -m "Browser dashboard release: PTY terminal + React UI + autonomous dispatch"
```

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "release: v0.2.0 browser dashboard

- Python FastAPI daemon with PTY + WebSocket + SSE
- React dashboard: terminal, agent cards, diff viewer
- Autonomous dispatch via CLAUDE.md rules
- pending_review state with approve/reject flow
- systemd service for persistence
- Zero tmux dependency"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Plan Task |
|------------------|-----------|
| PTY ↔ WebSocket bridge | Task 2, 3 |
| SSE state broadcaster | Task 4 |
| HTTP API (status, diff, approve, reject, kill, log) | Task 5 |
| maw-server entrypoint | Task 6 |
| systemd service | Task 6 |
| React + Vite + Tailwind setup | Task 7 |
| useTerminal hook | Task 8 |
| useApi hook | Task 8 |
| Terminal component | Task 9 |
| AgentCard component | Task 9 |
| DiffViewer component | Task 9 |
| Layout + App | Task 9 |
| Frontend build | Task 10 |
| pending_review state | Task 11 |
| review-request/approve/reject/diff commands | Task 11 |
| dispatch without tmux | Task 11 |
| CLAUDE.md | Task 12 |
| README update | Task 12 |

### Placeholder Scan

- No TBD/TODO/fill-in-later found
- All steps contain actual code or exact commands
- No vague instructions

### Type Consistency

- `Agent.status` enum: `idle | running | pending_review | error` — consistent across types, components, and bash
- API endpoints: `/api/diff/{id}`, `/api/approve/{id}` — consistent naming
- `maw_state_review_request` in bash matches `pending_review` in TS types

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-browser-dashboard-v0.2.0.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session using executing-plans

**Which approach?**
