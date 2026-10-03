// The backend suite against both reference backends - the protocol as two
// implementations speak it today: every MUST holds but the pinned expected
// failures of test/lib/expected.mjs (each with the place of its fix).
//   node-runtime: @abap2ui5/node-runtime + the ABAP conformance apps (transpiled
//                 on the fly; needs git access to fetch open-abap-core once)
//   cap2ui5:      a CAP project + @cap2ui5/cds-plugin + the JS conformance apps
//                 (skipped unless `npm ci --prefix conformance/hosts/cap2ui5` ran)
// PROTOCOL_SKIP_BACKENDS=1 skips both.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runBackendSuite } from "../conformance/backend/index.mjs";
import { ROOT } from "./lib/traffic.mjs";
import { BACKEND_EXPECTED_FAILURE_IDS } from "./lib/expected.mjs";

const skipAll = process.env.PROTOCOL_SKIP_BACKENDS ? "PROTOCOL_SKIP_BACKENDS is set" : false;
const capInstalled = fs.existsSync(path.join(ROOT, "conformance/hosts/cap2ui5/node_modules/@cap2ui5/cds-plugin"));

async function suite(start, profile) {
  const backend = await start();
  try {
    const report = await runBackendSuite({ url: backend.url, profile });
    const failed = report.results.filter((r) => r.status === "fail");
    assert.deepEqual(failed.map((r) => r.id), BACKEND_EXPECTED_FAILURE_IDS,
      `MUST checks failed against ${backend.url} other than the pinned ones:\n${failed.map((r) => `${r.id}: ${r.message}`).join("\n")}`);
    return report;
  } finally {
    await backend.close();
  }
}

test("node-runtime passes every MUST but the pinned ones and every SHOULD of the ui5 profile", { skip: skipAll, timeout: 600_000 }, async () => {
  const { startNodeRuntime } = await import("../conformance/hosts/node-runtime/serve.mjs");
  const report = await suite(() => startNodeRuntime({ build: true }), "ui5");
  assert.deepEqual(report.results.filter((r) => r.status === "warn").map((r) => r.id), []);
});

test("cap2ui5 passes every MUST but the pinned ones of the ui5 profile; its one warning is error.details", { skip: skipAll || (!capInstalled && "cap2UI5 host not installed - npm ci --prefix conformance/hosts/cap2ui5"), timeout: 600_000 }, async () => {
  const { startCap2ui5 } = await import("../conformance/hosts/cap2ui5/serve.mjs");
  const report = await suite(() => startCap2ui5(), "ui5");
  assert.deepEqual(report.results.filter((r) => r.status === "warn").map((r) => r.id), ["error.details"]);
});
