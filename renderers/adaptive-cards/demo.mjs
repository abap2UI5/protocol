#!/usr/bin/env node
/*
 * Render recorded traffic as an Adaptive Card - paste the output into
 * https://adaptivecards.io/designer (card payload editor) to see it.
 *
 *   node renderers/adaptive-cards/demo.mjs                       # BIND, first response
 *   node renderers/adaptive-cards/demo.mjs slots.popup-destroy 0 1   # responses 0 and 1 of a check, folded
 *   node renderers/adaptive-cards/demo.mjs --backend cap2ui5 message.box 0 1
 *   node renderers/adaptive-cards/demo.mjs --file response.json  # a response of your own
 *   node renderers/adaptive-cards/demo.mjs --list                # the recorded checks
 *
 * The card goes to stdout; what could not be rendered to stderr.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderResponses } from "./index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [v] = args.splice(i, 2).slice(1);
  return v;
};
const backend = opt("--backend") || "node-runtime";
const file = opt("--file");
const suite = () => JSON.parse(fs.readFileSync(path.join(ROOT, "traffic", backend, "suite.json"), "utf8"));

let responses;
if (args.includes("--list")) {
  for (const c of suite().checks) process.stdout.write(`${c.id} (${c.exchanges.length} exchange(s))\n`);
  process.exit(0);
} else if (file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  responses = Array.isArray(j) ? j : [j];
} else {
  const [id = "model.scalar", ...which] = args;
  const c = suite().checks.find((x) => x.id === id);
  if (!c) {
    process.stderr.write(`no recorded check "${id}" in traffic/${backend}/suite.json - --list shows them\n`);
    process.exit(2);
  }
  responses = (which.length ? which.map(Number) : [0]).map((i) => c.exchanges[i] && c.exchanges[i].response.body).filter((b) => b && typeof b === "object" && b.S_FRONT);
}

const { card, unsupported } = renderResponses(responses);
process.stdout.write(`${JSON.stringify(card, null, 2)}\n`);
for (const u of unsupported) process.stderr.write(`unsupported: ${u.control}${u.id ? ` #${u.id}` : ""} (${u.slot}) - ${u.reason}\n`);
