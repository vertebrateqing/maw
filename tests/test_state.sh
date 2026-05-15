#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mawlib/core.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mawlib/state.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/test_helper.sh"

setup() {
  export MAW_TEST_ROOT="/tmp/maw_state_test_$$"
  mkdir -p "$MAW_TEST_ROOT/.maw"
  cd "$MAW_TEST_ROOT"
  git init -q
  maw_state_init
}

teardown() {
  cd /
  rm -rf "$MAW_TEST_ROOT"
  unset MAW_TEST_ROOT
}

test_state_init() {
  setup
  assert_dir_exists "$MAW_TEST_ROOT/.maw"
  assert_dir_exists "$MAW_TEST_ROOT/.maw/logs"
  assert_dir_exists "$MAW_TEST_ROOT/.agents"
  [[ -f "$MAW_TEST_ROOT/.maw/state.json" ]] || { echo "  FAIL: state.json not found"; return 1; }
  teardown
}

test_state_add_agent() {
  setup
  maw_state_add_agent 1 "$MAW_TEST_ROOT/.agents/agent-1" "agent/1"
  local status
  status=$(maw_state_get_agent_status 1)
  assert_eq "$status" "idle"
  teardown
}

test_state_update_agent() {
  setup
  maw_state_add_agent 1 "$MAW_TEST_ROOT/.agents/agent-1" "agent/1"
  maw_state_update_agent 1 "running" "Implement auth" 12345
  local status
  status=$(maw_state_get_agent_status 1)
  assert_eq "$status" "running"
  teardown
}

test_state_list_agents() {
  setup
  maw_state_add_agent 1 "$MAW_TEST_ROOT/.agents/agent-1" "agent/1"
  maw_state_add_agent 2 "$MAW_TEST_ROOT/.agents/agent-2" "agent/2"
  local count
  count=$(maw_state_list_agents | wc -l)
  assert_eq "$count" "2"
  teardown
}

run_tests "$0"
