#!/usr/bin/env bash
# Registers this directory as a Claude Code plugin marketplace and installs `answers` for the user.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v claude >/dev/null 2>&1 || { echo "claude CLI not found in PATH" >&2; exit 1; }
claude plugin marketplace add "$HERE"
claude plugin install answers@answers-plugin --scope user
echo "Installed. In an open session run /reload-plugins (or restart it), then /answers."
