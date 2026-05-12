#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test_helper.sh"

test_hello_world() {
  local output
  output="$("$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../bin/hello")"
  assert_eq "$output" "hello world"
}

run_tests "$0"
