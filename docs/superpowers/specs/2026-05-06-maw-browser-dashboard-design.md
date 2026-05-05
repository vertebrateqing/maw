# MAW Browser Dashboard Design

## Overview

Replace tmux + Termius with a browser-based dashboard. A systemd-backed Python daemon runs on WSL2, exposing a Web terminal for the master Claude Code process and an HTTP dashboard for agent status, control, and diff review.

## Goals

1. **Browser-only interaction** — iPhone Safari is the primary interface, no Termius needed
2. **Claude-driven dispatch** — Master Claude Code autonomously decides when to spawn sub-agents via PTY commands
3. **Self-driven merge** — Sub-agents request review upon completion; master Claude approves/merges
4. **Beautiful, usable UI** — GitHub-like diff viewer, responsive layout, touch-optimized controls
5. **Session persistence** — systemd keeps the daemon alive; browser reconnects seamlessly

## Architecture

```
iPhone Safari
  └── Tailscale / Cloudflare Tunnel
        └── HTTPS/WS → WSL2:8080
              └── maw-server (Python daemon)
                    ├── PTY master ←→ WebSocket → xterm.js (left pane)
                    ├── Agent N: subprocess claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /diff, /approve, /reject, /kill)
                    └── SSE broadcaster (state.json changes)
```

## Backend: maw-server

### Process Model

```python
# maw-server.py
import asyncio, pty, os, subprocess, json, threading
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

# 1. PTY for master Claude
master_fd, master_child = pty.openpty()
master_proc = subprocess.Popen(
    ["claude"],
    stdin=master_child,
    stdout=master_child,
    stderr=master_child,
    preexec_fn=os.setsid,
)

# 2. State watcher thread
# Watches .maw/state.json for changes, broadcasts via SSE

# 3. WebSocket endpoint /ws/master
# Bidirectional: browser input → PTY stdin, PTY stdout → browser

# 4. HTTP endpoints
@app.get("/api/status")
@app.get("/api/diff/{agent_id}")
@app.post("/api/approve/{agent_id}")
@app.post("/api/reject/{agent_id}")
@app.post("/api/kill/{agent_id}")
@app.get("/api/log/{agent_id}")
```

### State Machine

```
IDLE → DISPATCHED → RUNNING → PENDING_REVIEW → APPROVED → MERGED
                                     ↓
                                  REJECTED → RESET → IDLE
```

| State | Meaning | Auto-triggered by |
|-------|---------|-------------------|
| `idle` | Agent ready | `maw init` or `maw reject` |
| `running` | Agent coding | `maw dispatch` (Claude types it) |
| `pending_review` | Agent done, waiting | Agent script on completion |
| `approved` | User/Claude approved | `maw approve` |
| `merged` | Branch merged to main | `maw merge` (after approve) |

### Claude Notification (PTY Injection)

When state changes to `pending_review`, the daemon writes into the master PTY:

```

[MAW] Agent-2 completed "Add unit tests" —  +120 -15 lines
        Run `maw diff 2` to review, `maw approve 2` to merge.

```

Master Claude sees this as terminal output and acts on it.

## Frontend: Dashboard UI

### Layout — Desktop / Landscape

```
┌──────────────────────────────────────────────────────────────────────┐
│  MAW  🟢 Online    3 agents | 1 running | 1 pending review          │
├─────────────────────────────────────────────┬────────────────────────┤
│                                             │  Agent Status          │
│  ┌─ Claude (Master) ───────────────────┐   │  ┌─ agent-1 ───────┐  │
│  │                                     │   │  │ 🔵 RUNNING      │  │
│  │  I'll refactor the auth module...   │   │  │ Refactor auth   │  │
│  │                                     │   │  │ 03:22  [Kill]   │  │
│  │  [streaming output]                 │   │  └─────────────────┘  │
│  │                                     │   │  ┌─ agent-2 ───────┐  │
│  │                                     │   │  │ 🟡 REVIEW       │  │
│  │                                     │   │  │ Add unit tests  │  │
│  │                                     │   │  │ +120 / -15      │  │
│  └─────────────────────────────────────┘   │  │ [Diff] [✓] [✗]  │  │
│                                             │  └─────────────────┘  │
│  > _                                        │  ┌─ agent-3 ───────┐  │
│                                             │  │ ⚪ IDLE         │  │
│                                             │  │ [Dispatch]      │  │
│                                             │  └─────────────────┘  │
├─────────────────────────────────────────────┴────────────────────────┤
│ [Ctrl+C] [Ctrl+D] [Tab] [Esc] [←] [→] [↑] [↓] [Fullscreen]         │
└──────────────────────────────────────────────────────────────────────┘
```

- **Left 65%**: xterm.js Web terminal (master Claude)
- **Right 35%**: Agent cards + detail view
- **Footer**: Floating shortcut bar

### Layout — Mobile Portrait

Tab-based single-column layout:

```
┌──────────────────────────────────────┐
│  MAW  🟢 Online                      │
│  [ Terminal ] [ Agents ] [Logs]      │
├──────────────────────────────────────┤
│                                      │
│  (Active tab content)                │
│                                      │
├──────────────────────────────────────┤
│  [Shortcuts ▲]                       │
└──────────────────────────────────────┘
```

- **Terminal tab**: Full-screen xterm.js
- **Agents tab**: Card list + detail view (diff/logs)
- **Swipe left/right** to switch tabs
- **Shortcuts bar**: Bottom sheet, swipe up to expand

### Agent Card States

#### IDLE

```
┌─ agent-3 ──────────────────────┐
│ ⚪ IDLE                        │
│                                │
│ [Quick Dispatch]               │
│ ┌────────────────────────────┐ │
│ │ Describe task...           │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

- Tap "Quick Dispatch" to expand input
- Textarea for task description
- Submit sends `maw dispatch "task" 3` to master PTY

#### RUNNING

```
┌─ agent-1 ──────────────────────┐
│ 🔵 RUNNING          03:22      │
│ Task: Refactor auth module     │
│                                │
│ [View Log]        [Kill]       │
└────────────────────────────────┘
```

- Elapsed time auto-updates (SSE)
- **View Log**: Expands inline log tailer (black background, green text)
- **Kill**: Confirms then terminates agent

#### PENDING REVIEW

```
┌─ agent-2 ──────────────────────┐
│ 🟡 PENDING REVIEW              │
│ Task: Add unit tests           │
│ Changes: +120 / -15 lines      │
│                                │
│ [View Diff]  [✓ Approve] [✗]   │
└────────────────────────────────┘
```

- Highlighted with yellow left border
- **View Diff**: Opens detail view (see Diff Viewer below)
- **Approve**: Runs `maw approve 2` + `maw merge 2`
- **Reject**: Runs `maw reject 2` (resets to idle)

### Diff Viewer (Detail View)

Triggered by tapping "View Diff" on a pending-review card.

#### Desktop / Landscape

Right panel switches to detail view:

```
┌─ Diff: agent-2 → main ─────────┐
│ 2 files changed, +120, -15     │
│                                │
│ ▼ src/auth.py        +45 -12   │
│ ┌────────────────────────────┐ │
│ │@@ -10,5 +10,8 @@          │ │
│ │ def login():               │ │
│ │                            │ │
│ │+# TODO: validate input    │ │  ← green add
│ │     pass                   │ │
│ │-    return None            │ │  ← red del
│ │+    return validate(data)  │ │  ← green add
│ │                            │ │
│ └────────────────────────────┘ │
│                                │
│ ▶ tests/test_auth.py   +75 -3 │
│                                │
│ [✓ Approve & Merge]  [✗ Reject]│
│ [← Back to list]               │
└────────────────────────────────┘
```

#### Mobile Portrait

Full-screen overlay / bottom sheet:

```
┌──────────────────────────────────────┐
│ ← Back              Diff (2 files)   │
├──────────────────────────────────────┤
│ ▼ src/auth.py (+45 -12)              │
│ ┌──────────────────────────────────┐ │
│ │ 10 | def login():                │ │
│ │    |                             │ │
│ │ 11+|     # TODO: validate        │ │
│ │ 12-|     pass                    │ │
│ │ 12+|     return validate(data)   │ │
│ └──────────────────────────────────┘ │
│ ▶ tests/test_auth.py (+75 -3)        │
├──────────────────────────────────────┤
│ [✓ Approve & Merge]   [✗ Reject]    │
└──────────────────────────────────────┘
```

#### Diff Rendering Spec

- **File headers**: Clickable to collapse/expand
- **Line numbers**: Old (gray) | New (gray)
- **Additions**: Background `#0d3b2e` (dark green), prefix `+` in `#4ec9b0`
- **Deletions**: Background `#3b0d0d` (dark red), prefix `-` in `#f48771`
- **Context**: No background, `#d4d4d4` text
- **Word-diff**: Highlight changed words within a line with brighter background
- **Syntax highlighting**: Pygments-generated CSS classes (`syntax-keyword`, `syntax-string`, etc.)
- **Scroll**: Independent scroll within diff viewer, preserves position on re-open
- **Copy**: Tap-hold on a line to copy

### Toast Notifications

Bottom-right corner (desktop) or top (mobile):

```
┌────────────────────────────────────┐
│ 🟡 Agent-2 completed — waiting     │
│    review. Tap to view diff.       │
│                          [Dismiss] │
└────────────────────────────────────┘
```

- Auto-dismiss after 10s unless hovered/tapped
- Tap jumps to agent detail
- Stacking: max 3 toasts, new ones push old

### Shortcut Bar (Footer)

```
[Ctrl+C] [Ctrl+D] [Tab] [Esc] [↑] [↓] [←] [→]
```

- **Desktop**: Fixed footer, always visible
- **Mobile**: Collapsible bottom sheet, swipe up to expand
- **Size**: Min 48x48px touch target
- **Haptic feedback**: On tap (via Navigator.vibrate)

## Color Theme

```css
:root {
  --bg-primary: #0d0d0d;       /* terminal background */
  --bg-panel: #1e1e1e;         /* dashboard panels */
  --bg-card: #252526;          /* agent cards */
  --border: #3c3c3c;
  --text-primary: #d4d4d4;
  --text-secondary: #858585;
  --color-running: #569cd6;    /* blue */
  --color-review: #dcdcaa;     /* yellow */
  --color-done: #4ec9b0;       /* green */
  --color-error: #f48771;      /* red */
  --diff-add-bg: #0d3b2e;
  --diff-add-text: #4ec9b0;
  --diff-del-bg: #3b0d0d;
  --diff-del-text: #f48771;
}
```

## Responsive Breakpoints

| Breakpoint | Layout | Terminal | Panel |
|------------|--------|----------|-------|
| ≥1200px | Side-by-side | 65% | 35% |
| 768–1199px | Side-by-side | 60% | 40% |
| 600–767px | Side-by-side | 50% | 50% |
| <600px | Tab switch | Full (tab) | Full (tab) |

## Data Flow

### Agent Dispatch

```
1. Master Claude types: maw dispatch "Refactor auth"
2. maw-server receives command via PTY
3. maw-server spawns: nohup claude "Refactor auth" > agent-1.log
4. maw-server updates state.json: agent-1 → running
5. SSE broadcasts update to all browsers
6. Browser UI updates agent-1 card to RUNNING
```

### Agent Completion → Review

```
1. Agent-1 script finishes, runs: maw review-request 1
2. state.json: agent-1 → pending_review
3. maw-server detects change
4. maw-server injects into master PTY:
   "[MAW] Agent-1 completed..."
5. SSE broadcasts to browsers
6. Browser shows toast + updates card
7. Master Claude sees PTY message, may run: maw diff 1 / maw approve 1
```

### User Approves via Browser

```
1. User taps [✓ Approve & Merge] on agent-2 card
2. Browser POST /api/approve/2
3. maw-server runs: git merge agent/2
4. state.json: agent-2 → idle
5. SSE broadcast
6. Browser updates card to IDLE
```

## CLAUDE.md (Project Root)

```markdown
# MAW Workflow

## When to Dispatch
If a user request can be broken into independent sub-tasks
(e.g., "implement auth" + "add tests" + "update docs"), dispatch them:

```bash
maw dispatch "Implement user authentication"
maw dispatch "Add unit tests for auth module"
```

## When to Review
When you see a notification like:
```
[MAW] Agent-N completed "...". Run `maw diff N` to review.
```

1. Run `maw diff N` to see changes
2. If acceptable, run `maw approve N` (auto-merges)
3. If not, run `maw reject N` (agent resets to idle)

## Status Check
Run `maw status` anytime to see agent board.
```

## Files

| File | Responsibility |
|------|---------------|
| `bin/maw-server` | Daemon entrypoint |
| `lib/server.py` | FastAPI app, routes |
| `lib/pty_bridge.py` | PTY ↔ WebSocket bridge |
| `lib/sse_broadcaster.py` | State file watcher + SSE |
| `static/index.html` | Dashboard SPA |
| `static/css/theme.css` | Tailwind custom theme |
| `static/js/terminal.js` | xterm.js integration |
| `static/js/dashboard.js` | Agent cards, diff viewer |
| `static/js/api.js` | HTTP API client |
| `CLAUDE.md` | Claude behavior rules |

## Security Considerations

- Bind to `127.0.0.1:8080` by default
- Access via Tailscale only (no public exposure)
- No authentication needed (Tailscale is the auth layer)
- Optional: basic auth via `MAW_PASSWORD` env var
