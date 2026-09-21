#!/usr/bin/env node
/**
 * Stage 5 of the pipeline: run the specs and record a machine-readable result.
 *
 * Cypress ships no JUnit reporter in this project, and adding one would mean a
 * new dependency plus an XML parser to read it back. The Module API already
 * returns exactly the shape the traceability report needs, so use it directly
 * and write `.ai/results/last-run.json`.
 *
 * Usage:
 *   node scripts/run-tests.js                       # every spec
 *   node scripts/run-tests.js "cypress/e2e/*.cy.js" # a subset
 */

const fs = require("fs");
const path = require("path");
const cypress = require("cypress");
const { testCaseIdFromTitle } = require("./lib/test-cases");

const RESULTS_DIR = path.join(__dirname, "..", ".ai", "results");
const RESULTS_FILE = path.join(RESULTS_DIR, "last-run.json");

/** Flattens `runs[].tests[]` into one list keyed by test case id. */
function collectTests(runs = []) {
  return runs.flatMap((run) =>
    (run.tests || []).map((test) => {
      const title = (test.title || []).join(" » ");
      return {
        spec: run.spec?.relative || "",
        title,
        testCaseId: testCaseIdFromTitle(title),
        state: test.state,
        durationMs: test.duration ?? null,
        // `displayError` carries the assertion text; keep the first line only
        // so a PR comment stays readable.
        error: test.displayError ? test.displayError.split("\n")[0] : null,
      };
    }),
  );
}

async function main() {
  const spec = process.argv[2];

  const results = await cypress.run({
    ...(spec ? { spec } : {}),
    // The spec reporter keeps the CI log readable; the JSON below is what the
    // reporting step actually consumes.
    reporter: "spec",
  });

  // A run-level failure (browser could not start, config error) has no test
  // results at all, so record it rather than reporting "0 tests, all passed".
  if (results.status === "failed") {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(
      RESULTS_FILE,
      `${JSON.stringify({ status: "failed", failureReason: results.message, tests: [] }, null, 2)}\n`,
    );
    console.error(`Cypress failed to run: ${results.message}`);
    process.exit(1);
  }

  const summary = {
    status: "finished",
    startedAt: results.startedTestsAt,
    endedAt: results.endedTestsAt,
    totalTests: results.totalTests,
    totalPassed: results.totalPassed,
    totalFailed: results.totalFailed,
    totalPending: results.totalPending,
    totalSkipped: results.totalSkipped,
    tests: collectTests(results.runs),
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_FILE, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), RESULTS_FILE)}`);

  process.exit(results.totalFailed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
