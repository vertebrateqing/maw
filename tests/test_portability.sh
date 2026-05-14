#!/usr/bin/env bash
set -euo pipefail

# MAW Portability Sanity Check
# Fails if any bash-4-only syntax is reintroduced into runtime shell files.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/test_helper.sh"

_bad_patterns="${BASH_SOURCE[0]}.bad_patterns"

test_no_bash4_parameter_expansions() {
  local files=(
    lib/core.sh lib/state.sh lib/ui.sh lib/git.sh
    bin/maw bin/maw-server
  )

  local found=""
  # ${var^^} / ${var,,} / ${var:offset} / ${var/pattern/repl}
  while IFS= read -r line; do
    found="$found$line\n"
  done < <(grep -nP '\$\{[A-Za-z_]+[\^,]\^?\}' "${files[@]}" 2>/dev/null || true)

  if [[ -n "$found" ]]; then
    echo "  FAIL: bash-4-only parameter expansions found:" >&2
    echo -e "$found" | sed 's/^/    /' >&2
    return 1
  fi

  echo "  PASS: no bash-4-only expansions"
}

test_no_declare_associative_array() {
  local found=""
  while IFS= read -r line; do
    found="$found$line\n"
  done < <(grep -nP '\bdeclare\s+-A\b' lib/*.sh bin/* 2>/dev/null || true)

  if [[ -n "$found" ]]; then
    echo "  FAIL: bash-4-only associative arrays found:" >&2
    echo -e "$found" | sed 's/^/    /' >&2
    return 1
  fi

  echo "  PASS: no associative arrays"
}

test_no_gnu_date_in_ui() {
  local raw
  raw=$(grep -nP '\bdate\s+-d\s+' lib/ui.sh 2>/dev/null || true)
  if [[ -z "$raw" ]]; then
    echo "  PASS: no GNU-only date -d in lib/ui.sh"
    return 0
  fi

  # Check the surrounding context (next 3 lines) for a fallback || chain.
  # GNU `date -d` is acceptable as the first arm of a fallback: ... 2>/dev/null || date -j ...
  while IFS= read -r line; do
    local lineno
    lineno=$(echo "$line" | cut -d: -f1)
    local context
    context=$(sed -n "${lineno},$((lineno + 3))p" lib/ui.sh)
    if [[ "$context" != *"||"* ]]; then
      echo "  FAIL: lib/ui.sh contains bare GNU-only 'date -d' (no fallback): $line" >&2
      return 1
    fi
  done <<< "$raw"
  echo "  PASS: GNU-only date -d is wrapped in a safe fallback chain"
}

run_tests "$0"
