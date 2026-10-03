#!/usr/bin/env node
/*
 * The check lists of conformance/backend/README.md and
 * conformance/frontend/README.md, between their <!-- checks:begin/end -->
 * markers, from the suites themselves.
 *   node scripts/gen-check-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CHECKS } from "../conformance/backend/lib/checks/index.mjs";
import { ALL_FRONTEND_CHECKS } from "../conformance/frontend/lib/checks/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const README = path.join(ROOT, "conformance/backend/README.md");
export const FRONTEND_README = path.join(ROOT, "conformance/frontend/README.md");

const link = (c) => `[${c.spec.replace(/^spec\/|^profiles\//, "")}](../../${c.spec})`;
const cell = (s) => s.replace(/\|/g, "\\|");

export function renderCheckList(checks) {
  const rows = ["| Check | Level | Profile | What | Spec |", "|---|---|---|---|---|"];
  for (const c of checks) rows.push(`| \`${c.id}\` | ${c.level} | ${c.profile} | ${cell(c.title)} | ${link(c)} |`);
  return rows.join("\n");
}

export function renderFrontendCheckList(checks) {
  const rows = ["| Check | Level | Profile | Needs | What | Spec |", "|---|---|---|---|---|---|"];
  for (const c of checks) rows.push(`| \`${c.id}\` | ${c.level} | ${c.profile} | ${(c.needs || []).join(", ") || "-"} | ${cell(c.title)} | ${link(c)} |`);
  return rows.join("\n");
}

const replace = (text, body) => text.replace(/(<!-- checks:begin[^>]*-->)[\s\S]*?(<!-- checks:end -->)/, (m, a, b) => `${a}\n\n${body}\n\n${b}`);

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(README, replace(fs.readFileSync(README, "utf8"), renderCheckList(ALL_CHECKS)));
  fs.writeFileSync(FRONTEND_README, replace(fs.readFileSync(FRONTEND_README, "utf8"), renderFrontendCheckList(ALL_FRONTEND_CHECKS)));
}
