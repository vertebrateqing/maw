#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/core.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/git.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/test_helper.sh"

setup() {
  export MAW_TEST_ROOT="/tmp/maw_git_test_$$"
  mkdir -p "$MAW_TEST_ROOT"
  cd "$MAW_TEST_ROOT"
  git init -q
  echo "main" > file.txt
  git add file.txt
  git commit -q -m "Initial commit"
}

teardown() {
  cd /
  rm -rf "$MAW_TEST_ROOT"
}

test_git_worktree_create() {
  setup
  maw_git_worktree_create 1
  assert_dir_exists "$MAW_TEST_ROOT/.agents/agent-1"
  [[ -f "$MAW_TEST_ROOT/.agents/agent-1/file.txt" ]] || { echo "  FAIL: worktree missing files"; return 1; }
  teardown
}

test_git_worktree_reset() {
  setup
  maw_git_worktree_create 1
  echo "agent change" > "$MAW_TEST_ROOT/.agents/agent-1/file.txt"
  maw_git_worktree_reset 1
  local content
  content=$(cat "$MAW_TEST_ROOT/.agents/agent-1/file.txt")
  assert_eq "$content" "main"
  teardown
}

run_tests "$0"
