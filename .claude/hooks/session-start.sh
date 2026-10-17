#!/bin/bash
# Instala dependencias al iniciar una sesión de Claude Code en la nube,
# para que tests (Vitest/Playwright), `npm run check` y `npm run build` anden.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
