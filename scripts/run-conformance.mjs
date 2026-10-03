#!/usr/bin/env node
/*
 * Start one of the reference backends with its conformance apps, run the
 * backend suite against it, stop it.
 *
 *   node scripts/run-conformance.mjs node-runtime|cap2ui5 [--profile core|ui5] [--json <file>] [--expected]
 *
 * node-runtime: @abap2ui5/node-runtime with the ABAP apps (conformance/hosts/node-runtime)
 * cap2ui5:      a CAP project with @cap2ui5/cds-plugin and the JS apps
 *               (conformance/hosts/cap2ui5 - npm ci --prefix conformance/hosts/cap2ui5 first)
 * Exit code: 0 when no MUST check failed. With --expected the reference
 * backends' pinned failures (test/lib/expected.mjs) are accepted: 0 when
 * exactly those checks failed - another failure, or a pinned check that
 * passes now (unpin it), is exit 1.
 */
import fs from "node:fs";
import { runBackendSuite, formatResult, formatSummary } from "../conformance/backend/index.mjs";
import { BACKEND_EXPECTED_FAILURE_IDS } from "../test/lib/expected.mjs";

const [name, ...rest] = process.argv.slice(2);
const opt = (k, d) => {
  const i = rest.indexOf(k);
  return i >= 0 ? rest[i + 1] : d;
};

async function start() {
  if (name === "node-runtime") return (await import("../conformance/hosts/node-runtime/serve.mjs")).startNodeRuntime({ build: true });
  if (name === "cap2ui5") return (await import("../conformance/hosts/cap2ui5/serve.mjs")).startCap2ui5();
  throw new Error("usage: node scripts/run-conformance.mjs node-runtime|cap2ui5 [--profile core|ui5] [--json <file>] [--expected]");
}

const backend = await start();
let report;
try {
  report = await runBackendSuite({
    url: backend.url,
    profile: opt("--profile", "ui5"),
    onResult: (r) => process.stdout.write(`${formatResult(r)}\n`),
  });
} finally {
  await backend.close();
}
process.stdout.write(`\n[${name}] ${formatSummary(report)}\n`);
const json = opt("--json");
if (json) fs.writeFileSync(json, `${JSON.stringify({ backend: name, ...report }, null, 2)}\n`);
if (!rest.includes("--expected")) process.exit(report.ok ? 0 : 1);
const failed = report.results.filter((r) => r.status === "fail").map((r) => r.id).sort();
const expected = [...BACKEND_EXPECTED_FAILURE_IDS].sort();
const same = failed.length === expected.length && failed.every((id, i) => id === expected[i]);
process.stdout.write(same
  ? `[${name}] the failures are exactly the pinned ones (test/lib/expected.mjs): ${expected.join(", ") || "none"}\n`
  : `[${name}] failures ${JSON.stringify(failed)} differ from the pinned ${JSON.stringify(expected)} (test/lib/expected.mjs)\n`);
process.exit(same ? 0 : 1);
