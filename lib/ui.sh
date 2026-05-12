#!/usr/bin/env bash
set -euo pipefail

# MAW UI Library
# Status board rendering and interactive menus

# maw_ui_status_symbol <status>
maw_ui_status_symbol() {
  local status="$1"
  case "$status" in
    running) echo "🔵" ;;
    done)    echo "🟢" ;;
    idle)    echo "⚪" ;;
    error)   echo "🔴" ;;
    *)       echo "⚫" ;;
  esac
}

# maw_ui_status_label <status> [lang]
# lang: en (default) or zh
maw_ui_status_label() {
  local status="$1"
  local lang="${2:-en}"

  if [[ "$lang" == "zh" ]]; then
    case "$status" in
      running) echo "运行中" ;;
      done)    echo "已完成" ;;
      idle)    echo "空闲" ;;
      error)   echo "错误" ;;
      *)       echo "未知" ;;
    esac
  else
    case "$status" in
      running) echo "RUN" ;;
      done)    echo "DONE" ;;
      idle)    echo "IDLE" ;;
      error)   echo "ERROR" ;;
      *)       echo "?" ;;
    esac
  fi
}

# maw_ui_truncate <string> <max_length>
maw_ui_truncate() {
  local str="$1"
  local max="$2"
  if [[ ${#str} -gt $max ]]; then
    echo "${str:0:$((max-3))}..."
  else
    printf "%-*s" "$max" "$str"
  fi
}

# maw_ui_elapsed_time <iso_timestamp>
maw_ui_elapsed_time() {
  local start="$1"
  if [[ -z "$start" || "$start" == "null" ]]; then
    echo "-"
    return
  fi

  local start_epoch now_epoch elapsed
  start_epoch=$(date -d "$start" +%s 2>/dev/null || date +%s)
  now_epoch=$(date +%s)
  elapsed=$((now_epoch - start_epoch))

  local hours=$((elapsed / 3600))
  local minutes=$(((elapsed % 3600) / 60))
  local seconds=$((elapsed % 60))

  if [[ $hours -gt 0 ]]; then
    printf "%02d:%02d:%02d" "$hours" "$minutes" "$seconds"
  else
    printf "%02d:%02d" "$minutes" "$seconds"
  fi
}

# maw_ui_render_board [lang]
# Renders the full status board
maw_ui_render_board() {
  local lang="${1:-en}"
  local state_file
  state_file="$(maw_state_file)"

  # Header
  if [[ "$lang" == "zh" ]]; then
    echo "┌─ MAW 状态看板 ──────────────────────────────────────────────┐"
    echo "│ ID  状态     分支      任务                    时间        │"
  else
    echo "┌─ MAW Status Board ──────────────────────────────────────────┐"
    echo "│ ID  Status  Branch    Task                   Elapsed      │"
  fi
  echo "│ ────────────────────────────────────────────────────────────│"

  # Agents
  local total=0 running=0 done_count=0 idle=0
  while IFS= read -r agent_json; do
    local id status branch task started_at
    id=$(echo "$agent_json" | jq -r '.id')
    status=$(echo "$agent_json" | jq -r '.status')
    branch=$(echo "$agent_json" | jq -r '.branch')
    task=$(echo "$agent_json" | jq -r '.task // ""')
    started_at=$(echo "$agent_json" | jq -r '.started_at // ""')

    local symbol label elapsed task_display
    symbol=$(maw_ui_status_symbol "$status")
    label=$(maw_ui_status_label "$status" "$lang")
    elapsed=$(maw_ui_elapsed_time "$started_at")
    task_display=$(maw_ui_truncate "$task" 26)

    printf "│ %-2s  %s %-6s  %-8s  %-26s  %-8s │\n" \
      "$id" "$symbol" "$label" "$branch" "$task_display" "$elapsed"

    total=$((total + 1))
    case "$status" in
      running) running=$((running + 1)) ;;
      done)    done_count=$((done_count + 1)) ;;
      idle)    idle=$((idle + 1)) ;;
    esac
  done < <(jq -c '.agents[]' "$state_file" 2>/dev/null || true)

  echo "└─────────────────────────────────────────────────────────────┘"

  # Summary line
  if [[ "$lang" == "zh" ]]; then
    echo "[$total 个代理 | ${running} 运行中 | ${done_count} 已完成 | ${idle} 空闲]"
  else
    echo "[$total agents | ${running} running | ${done_count} done | ${idle} idle]"
  fi
}

# maw_ui_render_menu [lang]
maw_ui_render_menu() {
  local lang="${1:-en}"

  if [[ "$lang" == "zh" ]]; then
    echo ""
    echo "可用命令:"
    echo "  list              - 列出所有代理"
    echo "  dispatch <任务>   - 派发任务到空闲代理"
    echo "  merge <id>        - 合并代理分支到 main"
    echo "  reset <id>        - 重置代理到 main"
    echo "  kill <id>         - 终止代理进程"
    echo "  status            - 显示状态看板"
    echo "  quit              - 退出菜单"
    echo ""
    echo -n "> "
  else
    echo ""
    echo "Available commands:"
    echo "  list              - List all agents"
    echo "  dispatch <task>   - Dispatch task to idle agent"
    echo "  merge <id>        - Merge agent branch into main"
    echo "  reset <id>        - Reset agent to main"
    echo "  kill <id>         - Kill agent process"
    echo "  status            - Show status board"
    echo "  quit              - Exit menu"
    echo ""
    echo -n "> "
  fi
}
