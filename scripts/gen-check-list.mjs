#!/usr/bin/env node
/*
 * The check list of conformance/backend/README.md, between its
 * <!-- checks:begin/end --> markers, from the suite itself.
 *   node scripts/gen-check-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CHECKS } from "../conformance/backend/lib/checks/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README = path.join(ROOT, "conformance/backend/README.md");

export function renderCheckList(checks) {
  const rows = ["| Check | Level | Profile | What | Spec |", "|---|---|---|---|---|"];
  for (const c of checks) {
    rows.push(`| \`${c.id}\` | ${c.level} | ${c.profile} | ${c.title.replace(/\|/g, "\\|")} | [${c.spec.replace(/^spec\/|^profiles\//, "")}](../../${c.spec}) |`);
  }
  return rows.join("\n");
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = fs.readFileSync(README, "utf8");
  const next = text.replace(/(<!-- checks:begin[^>]*-->)[\s\S]*?(<!-- checks:end -->)/, (m, a, b) => `${a}\n\n${renderCheckList(ALL_CHECKS)}\n\n${b}`);
  fs.writeFileSync(README, next);
}
