#!/usr/bin/env bash
set -euo pipefail

# Minimal test framework for MAW

TEST_PASSED=0
TEST_FAILED=0

assert_eq() {
  local expected="$1"
  local actual="$2"
  if [[ "$expected" != "$actual" ]]; then
    echo "  FAIL: expected '$expected', got '$actual'" >&2
    return 1
  fi
  echo "  PASS: assert_eq"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "  FAIL: expected '$haystack' to contain '$needle'" >&2
    return 1
  fi
  echo "  PASS: assert_contains"
}

assert_dir_exists() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "  FAIL: expected directory '$path' to exist" >&2
    return 1
  fi
  echo "  PASS: assert_dir_exists"
}

run_tests() {
  local script="$1"
  echo "Running tests in $(basename "$script")..."

  while IFS= read -r test_func; do
    [[ -z "$test_func" ]] && continue
    echo "  $test_func ..."
    set +e
    $test_func
    local rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      TEST_PASSED=$((TEST_PASSED + 1))
    else
      TEST_FAILED=$((TEST_FAILED + 1))
    fi
  done < <(compgen -A function | grep '^test_' || true)

  echo ""
  echo "Results: $TEST_PASSED passed, $TEST_FAILED failed"

  if [[ $TEST_FAILED -gt 0 ]]; then
    exit 1
  fi
}
