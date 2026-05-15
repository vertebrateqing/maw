#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mawlib/core.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mawlib/ui.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/test_helper.sh"

test_ui_status_symbol() {
  assert_eq "$(maw_ui_status_symbol "running")" "🔵"
  assert_eq "$(maw_ui_status_symbol "done")" "🟢"
  assert_eq "$(maw_ui_status_symbol "idle")" "⚪"
  assert_eq "$(maw_ui_status_symbol "error")" "🔴"
}

test_ui_truncate() {
  assert_eq "$(maw_ui_truncate "hello world" 8)" "hello..."
  assert_eq "$(maw_ui_truncate "hi" 8)" "hi      "
}

run_tests "$0"
