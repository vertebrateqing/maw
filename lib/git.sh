#!/usr/bin/env bash
set -euo pipefail

# MAW Git Operations
# Worktree, branch, merge helpers

# maw_git_worktree_create <agent_id>
maw_git_worktree_create() {
  local id="$1"
  local root
  root="$(maw_project_root)"
  local agents_dir
  agents_dir="$(maw_agents_dir)"
  local branch="agent/${id}"
  local worktree="${agents_dir}/agent-${id}"

  # Ensure agents directory exists
  maw_ensure_dir "$agents_dir"

  # Create branch if it doesn't exist
  if ! git -C "$root" show-ref --verify --quiet "refs/heads/${branch}"; then
    git -C "$root" branch "$branch"
    maw_log info "Created branch: $branch"
  fi

  # Create worktree if it doesn't exist
  if [[ ! -d "$worktree" ]]; then
    git -C "$root" worktree add "$worktree" "$branch"
    maw_log info "Created worktree: $worktree (branch: $branch)"
  fi
}

# maw_git_worktree_reset <agent_id>
# Resets the agent worktree to match main branch
maw_git_worktree_reset() {
  local id="$1"
  local root
  root="$(maw_project_root)"
  local worktree
  worktree="$(maw_agents_dir)/agent-${id}"
  local branch="agent/${id}"

  # Get current main branch name (main or master)
  local main_branch
  main_branch=$(git -C "$root" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
  if ! git -C "$root" show-ref --verify --quiet "refs/heads/${main_branch}"; then
    main_branch="master"
  fi
  if ! git -C "$root" show-ref --verify --quiet "refs/heads/${main_branch}"; then
    main_branch="main"
  fi

  # Reset worktree directly to main (no need to force-update branch)
  git -C "$worktree" checkout -B "$branch" "$main_branch"
  git -C "$worktree" reset --hard "$main_branch"
  git -C "$worktree" clean -fd

  maw_log info "Reset agent-${id} to ${main_branch}"
}

# maw_git_merge_agent <agent_id>
# Merges agent branch into main
maw_git_merge_agent() {
  local id="$1"
  local root
  root="$(maw_project_root)"
  local branch="agent/${id}"

  # Get main branch name
  local main_branch="main"
  if ! git -C "$root" show-ref --verify --quiet "refs/heads/main"; then
    main_branch="master"
  fi

  # Update local main from remote first
  git -C "$root" checkout "$main_branch"
  git -C "$root" pull origin "$main_branch" || true

  # Check if branch has commits ahead of main
  local ahead
  ahead=$(git -C "$root" rev-list --count "${main_branch}..${branch}" 2>/dev/null || echo "0")

  if [[ "$ahead" == "0" ]]; then
    maw_log info "Agent ${id} has no new commits to merge (already merged or no changes)"
    # Still push main in case it was merged before but not pushed
    git -C "$root" push origin "$main_branch" || true
    return 0
  fi

  # Perform merge
  if git -C "$root" merge --no-ff "$branch" -m "Merge agent/${id}"; then
    git -C "$root" push origin "$main_branch"
    maw_log info "Successfully merged agent/${id} into ${main_branch} and pushed"
    return 0
  else
    maw_log error "Merge conflict when merging agent/${id}. Please resolve manually."
    return 1
  fi
}
