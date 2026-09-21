#!/usr/bin/env node
/**
 * Stage 1 of the pipeline: Jira ticket -> normalised JSON.
 *
 * Writes `.ai/tickets/<KEY>.json`, which is the only input the test-case
 * designer reads. Keeping the fetch separate from the AI step means the ticket
 * snapshot is reviewable, replayable, and does not need Jira credentials to be
 * present on every later run.
 *
 * Usage:
 *   node scripts/jira-fetch.js SUR-1
 *
 * Credentials (Jira Cloud API token):
 *   JIRA_BASE_URL=https://your-org.atlassian.net
 *   JIRA_EMAIL=you@example.com
 *   JIRA_API_TOKEN=...
 *
 * With no credentials configured the script falls back to an existing snapshot
 * so the rest of the pipeline can be demoed offline.
 */

const fs = require("fs");
const path = require("path");

const TICKETS_DIR = path.join(__dirname, "..", ".ai", "tickets");

/**
 * Flattens Atlassian Document Format to plain text. The v3 REST API returns
 * descriptions as ADF, and the model reads this far better than raw nodes.
 */
function adfToText(node, depth = 0) {
  if (!node || typeof node !== "object") return "";

  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";

  const children = (node.content || [])
    .map((child) => adfToText(child, depth + 1))
    .join("");

  switch (node.type) {
    case "paragraph":
    case "heading":
      return `${children}\n`;
    case "listItem":
      return `- ${children.trim()}\n`;
    case "bulletList":
    case "orderedList":
      return `${children}\n`;
    case "codeBlock":
      return `\n\`\`\`\n${children}\n\`\`\`\n`;
    default:
      return children;
  }
}

/** Jira returns either ADF (API v3) or a plain string (v2 / some fields). */
function fieldToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return adfToText(value).replace(/\n{3,}/g, "\n\n").trim();
}

async function jiraGet(pathname, { baseUrl, email, token }) {
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Jira ${pathname} responded ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Acceptance criteria are the highest-signal input for test design but live in
 * a per-instance custom field, so resolve the field id by name rather than
 * hard-coding a `customfield_NNNNN` that only works on one Jira site.
 */
async function findAcceptanceCriteria(issue, auth) {
  try {
    const fields = await jiraGet("/rest/api/3/field", auth);
    const match = fields.find((field) => /acceptance\s*criteria/i.test(field.name || ""));
    return match ? fieldToText(issue.fields[match.id]) : "";
  } catch {
    // A token without field-metadata scope should not fail the whole fetch.
    return "";
  }
}

async function fetchFromJira(key, auth) {
  const issue = await jiraGet(
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=*navigable`,
    auth,
  );
  const fields = issue.fields || {};

  return {
    key: issue.key,
    url: new URL(`/browse/${issue.key}`, auth.baseUrl).toString(),
    summary: fields.summary || "",
    issueType: fields.issuetype?.name || "",
    status: fields.status?.name || "",
    priority: fields.priority?.name || "",
    labels: fields.labels || [],
    components: (fields.components || []).map((component) => component.name),
    description: fieldToText(fields.description),
    acceptanceCriteria: await findAcceptanceCriteria(issue, auth),
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error("Usage: node scripts/jira-fetch.js <TICKET-KEY>");
    process.exit(2);
  }

  const target = path.join(TICKETS_DIR, `${key}.json`);
  const auth = {
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    token: process.env.JIRA_API_TOKEN,
  };

  if (!auth.baseUrl || !auth.email || !auth.token) {
    if (fs.existsSync(target)) {
      console.log(
        `No Jira credentials set — reusing the existing snapshot ${path.relative(process.cwd(), target)}.`,
      );
      return;
    }
    console.error(
      "Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN, or commit a snapshot at " +
        path.relative(process.cwd(), target),
    );
    process.exit(1);
  }

  const ticket = await fetchFromJira(key, auth);
  fs.mkdirSync(TICKETS_DIR, { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(ticket, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), target)} — ${ticket.summary}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { adfToText, fieldToText };
