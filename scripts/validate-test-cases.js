#!/usr/bin/env node
/**
 * Quality gate between the AI test-case step and the pull request.
 *
 * A reviewer should be spending their attention on whether the coverage is
 * right, not on whether the model emitted a well-formed document. Anything
 * mechanically checkable is checked here so a malformed file never reaches the
 * review stage — and never reaches codegen, which relies on the same ids.
 *
 * Usage:
 *   node scripts/validate-test-cases.js test-cases/SUR-1.md
 */

const fs = require("fs");
const path = require("path");
const { parseTestCaseFile, PRIORITIES, TYPES } = require("./lib/test-cases");

function validate(file) {
  const errors = [];
  const warnings = [];
  const { meta, cases } = parseTestCaseFile(fs.readFileSync(file, "utf8"));

  const ticket = meta.ticket;
  if (!ticket) errors.push("frontmatter is missing `ticket:`");
  if (!meta.title) warnings.push("frontmatter is missing `title:`");

  if (cases.length === 0) {
    errors.push("no test cases found — each case needs a `### <ID> — <title>` heading");
  }

  const seen = new Set();
  let previousNumber = 0;

  cases.forEach((testCase, index) => {
    const label = testCase.id || `case #${index + 1}`;

    if (!testCase.id) {
      errors.push(`${label}: heading has no test case id (expected ${ticket || "<TICKET>"}-TC-NN)`);
    } else {
      // Ids are the join key between an approved case and the test that
      // implements it, so they must be unique and belong to this ticket.
      if (seen.has(testCase.id)) errors.push(`${testCase.id}: duplicate id`);
      seen.add(testCase.id);

      if (ticket && !testCase.id.startsWith(`${ticket}-TC-`)) {
        errors.push(`${testCase.id}: does not belong to ${ticket}`);
      }

      // Increasing but not necessarily dense: a retired case leaves a gap, and
      // closing it would silently repoint an id at a different behaviour while
      // specs and past run reports still reference the old meaning.
      const number = Number(testCase.id.slice(testCase.id.lastIndexOf("-") + 1));
      if (number <= previousNumber) {
        errors.push(`${testCase.id}: ids must increase down the document (follows TC-${String(previousNumber).padStart(2, "0")})`);
      }
      previousNumber = number;
    }

    if (!testCase.title) errors.push(`${label}: heading has no title`);

    if (!PRIORITIES.includes(testCase.priority)) {
      errors.push(`${label}: Priority must be one of ${PRIORITIES.join(", ")} (got ${testCase.priority ?? "nothing"})`);
    }
    if (!TYPES.includes(testCase.type)) {
      errors.push(`${label}: Type must be one of ${TYPES.join(", ")} (got ${testCase.type ?? "nothing"})`);
    }
    if (!["yes", "no"].includes(testCase.automate)) {
      errors.push(`${label}: Automate must be yes or no (got ${testCase.automate || "nothing"})`);
    }
    if (testCase.automate === "yes" && testCase.type === "Manual") {
      errors.push(`${label}: cannot be Automate: yes and Type: Manual`);
    }

    if (testCase.steps.length === 0) errors.push(`${label}: has no Steps`);
    if (testCase.expected.length === 0) errors.push(`${label}: has no Expected results`);
  });

  if (cases.length > 0 && !cases.some((testCase) => testCase.automate === "yes")) {
    warnings.push("no case is marked `Automate: yes` — the codegen stage will have nothing to build");
  }

  return { errors, warnings, cases };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/validate-test-cases.js <file.md> [...]");
    process.exit(2);
  }

  let failed = false;
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`✖ ${file}: not found`);
      failed = true;
      continue;
    }

    const { errors, warnings, cases } = validate(file);
    const name = path.relative(process.cwd(), file);

    for (const warning of warnings) console.warn(`⚠ ${name}: ${warning}`);
    for (const error of errors) console.error(`✖ ${name}: ${error}`);

    if (errors.length === 0) {
      const automated = cases.filter((testCase) => testCase.automate === "yes").length;
      console.log(`✔ ${name}: ${cases.length} case(s), ${automated} to automate`);
    } else {
      failed = true;
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
