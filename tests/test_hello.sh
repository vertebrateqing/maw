#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test_helper.sh"

test_hello_world() {
  assert_eq "hello" "hello"
  assert_contains "hello world" "hello"
}

run_tests "$0"
