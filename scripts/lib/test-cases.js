/**
 * Parsing helpers for the test-case markdown files in `test-cases/`.
 *
 * These files are the human review gate of the pipeline: a reviewer reads and
 * edits them in a pull request, so they stay markdown rather than JSON. Every
 * consumer downstream (validation, traceability reporting) goes through here so
 * there is exactly one definition of the format.
 */

/** A test case id looks like `SUR-1-TC-01` — the ticket key plus a counter. */
const CASE_ID = /\b([A-Z][A-Z0-9]+-\d+-TC-\d{2})\b/;

const PRIORITIES = ["P1", "P2", "P3"];
const TYPES = ["E2E", "CT", "Manual"];

/**
 * Splits `---` fenced `key: value` frontmatter off the top of a document.
 * Deliberately not YAML: the frontmatter only ever holds flat strings, and a
 * parser dependency would be more surface than the format needs.
 */
function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) return { meta: {}, body: markdown };

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (field) meta[field[1]] = field[2].trim();
  }
  return { meta, body: markdown.slice(match[0].length) };
}

/** `- **Priority:** P1` → `P1`. Returns undefined when the label is absent. */
function readLabel(block, label) {
  const found = new RegExp(`\\*\\*${label}:?\\*\\*\\s*(.+)`, "i").exec(block);
  return found ? found[1].trim().replace(/\s+$/, "") : undefined;
}

/**
 * Collects the list items under a `**Heading**` line, stopping at the next
 * bold heading or the end of the block. Handles both `- ` and `1. ` markers so
 * steps can be numbered and expectations bulleted.
 */
function readList(block, heading) {
  const start = new RegExp(`^\\*\\*${heading}\\*\\*\\s*$`, "im").exec(block);
  if (!start) return [];

  const rest = block.slice(start.index + start[0].length);
  const items = [];
  for (const line of rest.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\*\*.+\*\*\s*$/.test(trimmed)) break; // next section
    const item = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (item) items.push(item[1].trim());
    else break;
  }
  return items;
}

/**
 * Parses a whole test-case document.
 *
 * @returns {{meta: object, cases: Array<object>}}
 */
function parseTestCaseFile(markdown) {
  const { meta, body } = parseFrontmatter(markdown);

  // `###` headings delimit cases; anything above the first one is preamble.
  const sections = body.split(/^###\s+/m).slice(1);

  const cases = sections.map((section) => {
    const [headingLine, ...rest] = section.split(/\r?\n/);
    const block = rest.join("\n");
    const id = CASE_ID.exec(headingLine);

    return {
      id: id ? id[1] : null,
      // The heading is `<id> — <title>`; strip the id and any dash separator.
      title: headingLine
        .replace(CASE_ID, "")
        .replace(/^\s*[—\-–:]\s*/, "")
        .trim(),
      priority: readLabel(block, "Priority"),
      type: readLabel(block, "Type"),
      // Anything other than an explicit "no" keeps the case in scope for
      // codegen, so a malformed value fails loudly in validation instead of
      // silently dropping coverage.
      automate: (readLabel(block, "Automate") || "").toLowerCase(),
      preconditions: readList(block, "Preconditions"),
      steps: readList(block, "Steps"),
      expected: readList(block, "Expected"),
    };
  });

  return { meta, cases };
}

/**
 * Pulls the test case id out of a Cypress test title. Generated specs name each
 * `it()` after its case (`SUR-1-TC-01 — ...`), which is what lets a run result
 * be traced back to the ticket it came from.
 */
function testCaseIdFromTitle(title) {
  const found = CASE_ID.exec(title);
  return found ? found[1] : null;
}

module.exports = {
  CASE_ID,
  PRIORITIES,
  TYPES,
  parseFrontmatter,
  parseTestCaseFile,
  testCaseIdFromTitle,
};
