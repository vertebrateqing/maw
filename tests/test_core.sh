#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mawlib/core.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/test_helper.sh"

test_maw_log_info() {
  local output
  output=$(maw_log info "test message" 2>&1 || true)
  assert_contains "$output" "[INFO]"
  assert_contains "$output" "test message"
}

test_maw_log_error() {
  local output
  output=$(maw_log error "error message" 2>&1 || true)
  assert_contains "$output" "[ERROR]"
}

test_maw_die() {
  local output
  output=$(maw_die "fatal error" 2>&1) || true
  assert_contains "$output" "[FATAL]"
  assert_contains "$output" "fatal error"
}

test_maw_ensure_dir() {
  local tmpdir="/tmp/maw_test_$$"
  maw_ensure_dir "$tmpdir/nested/path"
  assert_dir_exists "$tmpdir/nested/path"
  rm -rf "$tmpdir"
}

run_tests "$0"
