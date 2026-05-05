#!/usr/bin/env bash
set -euo pipefail

# MAW Installer

echo "Installing MAW..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect shell config
SHELL_CONFIG=""
if [[ "$SHELL" == */bash ]]; then
  SHELL_CONFIG="$HOME/.bashrc"
elif [[ "$SHELL" == */zsh ]]; then
  SHELL_CONFIG="$HOME/.zshrc"
fi

# Add to PATH
if [[ -n "$SHELL_CONFIG" ]]; then
  if ! grep -q "maw/bin" "$SHELL_CONFIG" 2>/dev/null; then
    echo "export PATH=\"$SCRIPT_DIR/bin:\$PATH\"" >> "$SHELL_CONFIG"
    echo "Added maw to PATH in $SHELL_CONFIG"
    echo "Run: source $SHELL_CONFIG"
  fi
fi

# Make executable
chmod +x "$SCRIPT_DIR/bin/maw"
chmod +x "$SCRIPT_DIR/tests/run_all.sh"

echo "MAW installed successfully!"
echo ""
echo "Next steps:"
echo "  1. source $SHELL_CONFIG"
echo "  2. cd /path/to/your/project"
echo "  3. maw init 4"
