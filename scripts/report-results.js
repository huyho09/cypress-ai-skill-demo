#!/usr/bin/env node
/**
 * Final stage: join the run results back to the reviewed test cases.
 *
 * This is what makes the pipeline auditable — a reviewer approved a list of
 * test cases, and this says what happened to each one, including the cases that
 * were approved for automation but have no test implementing them yet.
 *
 * Usage:
 *   node scripts/report-results.js SUR-1
 *
 * Writes `.ai/results/<TICKET>-report.md` and prints it, so CI can pipe it
 * straight into a pull request comment. Always exits 0: the run itself is the
 * pass/fail gate, and the report still needs to be published when it fails.
 */

const fs = require("fs");
const path = require("path");
const { parseTestCaseFile } = require("./lib/test-cases");

const ROOT = path.join(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, ".ai", "results", "last-run.json");

const OUTCOME = {
  passed: "✅ Passed",
  failed: "❌ Failed",
  pending: "⏭️ Skipped",
  skipped: "⏭️ Skipped",
};

/** Markdown cells must not break the table when a title contains a pipe. */
function cell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function buildReport(ticket, cases, run) {
  const byId = new Map();
  for (const test of run.tests || []) {
    if (test.testCaseId) byId.set(test.testCaseId, test);
  }

  const rows = cases.map((testCase) => {
    const test = byId.get(testCase.id);
    let outcome;

    if (test) {
      outcome = OUTCOME[test.state] || test.state;
    } else if (testCase.automate === "yes") {
      // An approved-for-automation case with no test is a coverage gap, not a
      // pass. Surfacing it here is the whole point of the join.
      outcome = "⚠️ Not implemented";
    } else {
      outcome = "🖐️ Not automated";
    }

    return { testCase, test, outcome };
  });

  const orphans = (run.tests || []).filter(
    (test) => !test.testCaseId || !cases.some((testCase) => testCase.id === test.testCaseId),
  );

  const lines = [];
  lines.push(`## Test results — ${ticket}`);
  lines.push("");

  if (run.status === "failed") {
    lines.push(`> Cypress could not complete the run: ${run.failureReason}`);
    lines.push("");
  }

  lines.push(
    `**${run.totalPassed ?? 0} passed · ${run.totalFailed ?? 0} failed · ${(run.totalPending ?? 0) + (run.totalSkipped ?? 0)} skipped**`,
  );
  lines.push("");
  lines.push("| Test case | Title | Priority | Result | Notes |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const { testCase, test, outcome } of rows) {
    lines.push(
      `| ${cell(testCase.id)} | ${cell(testCase.title)} | ${cell(testCase.priority)} | ${outcome} | ${cell(test?.error || "")} |`,
    );
  }

  const gaps = rows.filter(({ outcome }) => outcome === "⚠️ Not implemented");
  if (gaps.length > 0) {
    lines.push("");
    lines.push(
      `⚠️ ${gaps.length} case(s) approved for automation have no matching test. Each generated \`it()\` title must start with its test case id.`,
    );
  }

  if (orphans.length > 0) {
    lines.push("");
    lines.push("<details><summary>Tests not linked to a test case</summary>");
    lines.push("");
    for (const test of orphans) {
      lines.push(`- \`${test.spec}\` — ${cell(test.title)} (${test.state})`);
    }
    lines.push("</details>");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const ticket = process.argv[2];
  if (!ticket) {
    console.error("Usage: node scripts/report-results.js <TICKET-KEY>");
    process.exit(2);
  }

  const testCaseFile = path.join(ROOT, "test-cases", `${ticket}.md`);
  if (!fs.existsSync(testCaseFile)) {
    console.error(`No test cases at ${path.relative(ROOT, testCaseFile)}`);
    process.exit(2);
  }
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`No run results at ${path.relative(ROOT, RESULTS_FILE)} — run \`npm test\` first`);
    process.exit(2);
  }

  const { cases } = parseTestCaseFile(fs.readFileSync(testCaseFile, "utf8"));
  const run = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  const report = buildReport(ticket, cases, run);

  const target = path.join(ROOT, ".ai", "results", `${ticket}-report.md`);
  fs.writeFileSync(target, report);
  process.stdout.write(report);
}

main();
