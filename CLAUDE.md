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
