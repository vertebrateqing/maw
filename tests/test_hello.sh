#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test_helper.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/core.sh"

test_hello_command() {
  local output
  output=$("$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../bin/hello")
  assert_eq "hello world" "$output"
}

test_maw_hello_default() {
  local output
  output=$(maw_hello)
  assert_eq "hello world" "$output"
}

test_maw_hello_name() {
  local output
  output=$(maw_hello "maw")
  assert_eq "hello maw" "$output"
}

run_tests "$0"
