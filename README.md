# cypress-ai-skill-demo

A CI/CD pipeline that turns a Jira ticket into executed Cypress tests, with one
human review gate in the middle.

```
Jira ticket → test cases → pull request review → test code → execution → results
   fetch         Claude          a human           Claude      Cypress     Claude-
  (script)   test-case-designer   approves      cypress-author            free join
```

The review gate is the point of the design. A reviewer corrects the *test
design* while it is still markdown — before any code exists — and the approved
markdown, not the ticket, is what the automation stage builds from.

## Running it locally

```bash
npm ci
npm run ai:ticket      -- SUR-1   # Jira  → .ai/tickets/SUR-1.json
npm run ai:test-cases  -- SUR-1   # ticket → test-cases/SUR-1.md   (Claude)
npm run ai:validate    -- test-cases/SUR-1.md
npm run ai:test-code   -- SUR-1   # cases  → cypress/e2e/*.cy.js    (Claude)
npm test                          # run    → .ai/results/last-run.json
npm run ai:report      -- SUR-1   # join   → results per test case
```

`SUR-1` ships as a worked example, so the pipeline runs end to end without Jira
credentials: `ai:ticket` reuses the committed snapshot when none are set.

Credentials for the run go in `cypress.env.json` (git-ignored) or the
environment:

```bash
CYPRESS_TEST_USER='...' CYPRESS_TEST_PASS='...' npm test
```

## How the stages connect

Every test case carries an id — `SUR-1-TC-01` — and every generated `it()` title
starts with it. That id is the only thing tying the stages together, and it is
what lets the last stage report per acceptance criterion rather than per spec
file:

| Test case | Title | Priority | Result |
| --- | --- | --- | --- |
| SUR-1-TC-01 | Valid credentials land on the dashboard | P1 | ✅ Passed |
| SUR-1-TC-03 | The Login button stays disabled until both fields are valid | P2 | ⚠️ Not implemented |

A case approved for automation with no test behind it is reported as a gap, not
as a pass — silent under-coverage is the failure mode this pipeline exists to
prevent.

## Layout

| Path | Role |
| --- | --- |
| `scripts/jira-fetch.js` | Jira issue → `.ai/tickets/<KEY>.json` |
| `.claude/skills/test-case-designer/` | Ticket → reviewable test cases |
| `scripts/validate-test-cases.js` | Format gate, run before the PR and before codegen |
| `.agents/skills/cypress-author/` | Approved cases → spec code (vendored, `skills-lock.json`) |
| `scripts/run-tests.js` | Cypress Module API run → `.ai/results/last-run.json` |
| `scripts/report-results.js` | Results ⋈ test cases → the table above |
| `.github/workflows/` | The same steps, wired to Jira and pull requests |

## In CI

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ai-test-cases.yml` | Manual, or a Jira `repository_dispatch` | Fetches, designs, opens the review PR |
| `ai-test-code.yml` | PR **approved** and labelled `ai-test-cases` | Writes the spec, pushes, calls the run |
| `cypress-run.yml` | Reusable, plus any PR to `main` | Runs the specs, comments the results |

Required repository secrets:

| Secret | Used by |
| --- | --- |
| `ANTHROPIC_API_KEY` | Both Claude stages |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Ticket fetch |
| `CYPRESS_TEST_USER`, `CYPRESS_TEST_PASS` | Test execution |

The `ai-test-cases` label must exist in the repository, and "Allow GitHub Actions
to create and approve pull requests" must be enabled in
**Settings → Actions → General**.
