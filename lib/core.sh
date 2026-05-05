#!/usr/bin/env bash
set -euo pipefail

# MAW Core Library
# Logging, configuration, and utility functions

# Colors (disabled if not a TTY)
readonly MAW_RED='\033[0;31m'
readonly MAW_GREEN='\033[0;32m'
readonly MAW_YELLOW='\033[0;33m'
readonly MAW_BLUE='\033[0;34m'
readonly MAW_CYAN='\033[0;36m'
readonly MAW_RESET='\033[0m'

# maw_log <level> <message>
# Levels: debug, info, warn, error, fatal
maw_log() {
  local level="$1"
  local message="$2"
  local color=""
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  case "$level" in
    debug) color="${MAW_CYAN}" ;;
    info)  color="${MAW_GREEN}" ;;
    warn)  color="${MAW_YELLOW}" ;;
    error) color="${MAW_RED}" ;;
    fatal) color="${MAW_RED}" ;;
  esac

  if [[ -t 2 ]]; then
    echo -e "${color}[${level^^}]${MAW_RESET} ${timestamp} ${message}" >&2
  else
    echo "[${level^^}] ${timestamp} ${message}" >&2
  fi
}

# maw_die <message> [exit_code]
maw_die() {
  local message="$1"
  local exit_code="${2:-1}"
  maw_log fatal "$message"
  exit "$exit_code"
}

# maw_ensure_dir <path>
maw_ensure_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    mkdir -p "$path" || maw_die "Failed to create directory: $path"
  fi
}

# maw_config_get <var_name> <default_value>
maw_config_get() {
  local var_name="$1"
  local default_value="$2"
  local value
  value="${!var_name:-$default_value}"
  echo "$value"
}

# maw_project_root - find the git project root
maw_project_root() {
  local dir="${PWD}"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.git" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  maw_die "Not inside a git repository"
}

# maw_maw_dir - get the .maw directory for current project
maw_maw_dir() {
  local root
  root="$(maw_project_root)"
  echo "${root}/.maw"
}

# maw_agents_dir - get the .agents directory
maw_agents_dir() {
  local root
  root="$(maw_project_root)"
  echo "${root}/.agents"
}
