#!/usr/bin/env bash
set -euo pipefail

# MAW Test Runner
# Run all test files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

echo "================================"
echo "MAW Test Suite"
echo "================================"
echo ""

FAILED=0
PASSED=0

for test_file in tests/test_*.sh; do
  echo "Running $(basename "$test_file")..."
  if bash "$test_file"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    echo "  ^^^ FAILED ^^^"
  fi
  echo ""
done

echo "================================"
echo "Results: $PASSED passed, $FAILED failed"
echo "================================"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
