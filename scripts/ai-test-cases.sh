#!/usr/bin/env bash
#
# Stage 2: ticket snapshot -> reviewable test cases.
#
# Runs Claude Code headlessly against the test-case-designer skill. The tool
# allowlist is deliberately narrow: this stage reads the ticket and the existing
# specs, writes one markdown file, and runs the validator. It has no reason to
# touch anything else.
#
#   ./scripts/ai-test-cases.sh SUR-1
#
set -euo pipefail

TICKET="${1:?Usage: scripts/ai-test-cases.sh <TICKET-KEY>}"
cd "$(dirname "$0")/.."

if [ ! -f ".ai/tickets/${TICKET}.json" ]; then
  echo "No ticket snapshot at .ai/tickets/${TICKET}.json — run 'npm run ai:ticket -- ${TICKET}' first." >&2
  exit 1
fi

claude -p "Use the test-case-designer skill to turn .ai/tickets/${TICKET}.json into test-cases/${TICKET}.md.

Read the existing specs in cypress/e2e/ first so you can note coverage that already exists. Write only test-cases/${TICKET}.md — do not write or modify any spec code in this stage. Before finishing, run the validator and fix anything it reports." \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "Bash(node scripts/validate-test-cases.js:*)"

# Re-run the gate outside the model's control: the pull request must never be
# opened on a document that does not parse.
node scripts/validate-test-cases.js "test-cases/${TICKET}.md"
