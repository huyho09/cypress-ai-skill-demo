#!/usr/bin/env bash
#
# Stage 4: approved test cases -> Cypress spec.
#
# Runs after a human has approved the test-case document in a pull request, so
# the approved markdown — not the original ticket — is the source of truth here.
# Uses the vendored cypress-author skill, which already encodes this project's
# authoring conventions.
#
#   ./scripts/ai-test-code.sh SUR-1
#
set -euo pipefail

TICKET="${1:?Usage: scripts/ai-test-code.sh <TICKET-KEY>}"
cd "$(dirname "$0")/.."

CASES="test-cases/${TICKET}.md"
if [ ! -f "$CASES" ]; then
  echo "No test cases at ${CASES}." >&2
  exit 1
fi

# Never generate code from a document that would not have passed review.
node scripts/validate-test-cases.js "$CASES"

claude -p "Use the cypress-author skill to create or update the Cypress E2E spec for ${CASES}.

Implement every case in that file marked 'Automate: yes', and only those.

Traceability requirement: each it() title MUST begin with the test case id exactly as written in the document, in the form 'SUR-1-TC-01 — <the case title>'. The results report joins run output back to the ticket on that id, so a test whose title omits it is reported as missing coverage.

Follow the conventions already in cypress/e2e/login.cy.js: data-cy selectors, cy.env() for credentials, cy.intercept() aliases instead of arbitrary waits, and the country-lookup stub. Reuse that spec's setup rather than duplicating it where the flows overlap." \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep"
