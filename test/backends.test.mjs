// The backend suite against both reference backends - the protocol as two
// implementations speak it today: every MUST holds but the pinned expected
// failures of test/lib/expected.mjs (each with the place of its fix).
//   node-runtime: @abap2ui5/node-runtime + the ABAP conformance apps (transpiled
//                 on the fly; needs git access to fetch open-abap-core once)
//   cap2ui5:      a CAP project + @cap2ui5/cds-plugin + the JS conformance apps
//                 (skipped unless `npm ci --prefix conformance/hosts/cap2ui5` ran)
// PROTOCOL_SKIP_BACKENDS=1 skips both. The node-runtime host also serves the
// terminal renderer's end-to-end run.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runBackendSuite } from "../conformance/backend/index.mjs";
import { ROOT } from "./lib/traffic.mjs";
import { BACKEND_EXPECTED_FAILURE_IDS } from "./lib/expected.mjs";

const skipAll = process.env.PROTOCOL_SKIP_BACKENDS ? "PROTOCOL_SKIP_BACKENDS is set" : false;
const capInstalled = fs.existsSync(path.join(ROOT, "conformance/hosts/cap2ui5/node_modules/@cap2ui5/cds-plugin"));

async function suite(start, profile, after) {
  const backend = await start();
  try {
    const report = await runBackendSuite({ url: backend.url, profile });
    const failed = report.results.filter((r) => r.status === "fail");
    assert.deepEqual(failed.map((r) => r.id), BACKEND_EXPECTED_FAILURE_IDS,
      `MUST checks failed against ${backend.url} other than the pinned ones:\n${failed.map((r) => `${r.id}: ${r.message}`).join("\n")}`);
    if (after) await after(backend);
    return report;
  } finally {
    await backend.close();
  }
}

test("node-runtime passes every MUST but the pinned ones and every SHOULD of the ui5 profile", { skip: skipAll, timeout: 600_000 }, async (t) => {
  const { startNodeRuntime } = await import("../conformance/hosts/node-runtime/serve.mjs");
  // the same host then serves the terminal renderer's end-to-end run
  const report = await suite(() => startNodeRuntime({ build: true }), "ui5", (backend) => t.test("the terminal renderer drives the conformance apps on it", () => terminalEndToEnd(backend.url)));
  assert.deepEqual(report.results.filter((r) => r.status === "warn").map((r) => r.id), []);
});

/*
 * The terminal renderer (renderers/terminal/) against a real backend, driven
 * with keys through its state machine: BIND (edits, a check box, a press, a
 * table that grows - the summary the backend computes is on screen), ROUTE
 * (the hash history: a routed nav_app_call and Back restoring the caller),
 * NAV (the target's back button), and the CLI's --print of BIND, which is
 * the golden screen recorded from this backend's traffic.
 */
async function terminalEndToEnd(url) {
  const { createSession, createTerminalApp } = await import("../renderers/terminal/index.mjs");
  const open = async (cls) => {
    const session = createSession({ url });
    const app = createTerminalApp({ session, width: 80, height: 30 });
    await session.start(cls);
    assert.equal(session.error, null, session.error && session.error.text);
    return { session, app };
  };
  const tabTo = async (app, match) => {
    for (let i = 0; i < 40 && !match(app.focused() || {}); i += 1) await app.key("tab");
    assert.ok(match(app.focused() || {}), `not reachable: ${match}`);
  };

  let { session, app } = await open("Z2UI5_CL_CONF_BIND");
  assert.equal(app.focused().path, "/NAME");
  await app.key("ctrl-u");
  await app.type("Ada");
  await app.key("tab");
  await app.key("tab");
  await app.key("space");
  await tabTo(app, (w) => w.path === "/T_ITEMS/1/TEXT");
  await app.key("ctrl-u");
  await app.type("zwei");
  await tabTo(app, (w) => w.label === "Check");
  await app.key("enter");
  assert.match(app.print(), /\nAda;1;X;Berlin;10115;1:one:,2:zwei:,3:three:\n/);
  await tabTo(app, (w) => w.label === "Add row");
  await app.key("enter");
  assert.match(app.print(), /4:new:\n[\s\S]*4 \| \[new_+\] \| \[ \]/);

  ({ session, app } = await open("Z2UI5_CL_CONF_ROUTE"));
  const first = session.state.id;
  assert.equal(session.hash, `#/app/Z2UI5_CL_CONF_ROUTE/${first}`);
  await tabTo(app, (w) => w.label === "Count");
  await app.key("enter");
  await tabTo(app, (w) => w.label === "Call");
  await app.key("enter");
  assert.equal(session.state.app, "Z2UI5_CL_CONF_NAV_TGT");
  assert.match(app.print(), /from route/);
  assert.equal(session.history.entries.length, 2);
  await app.key("alt-left");
  assert.equal(session.state.app, "Z2UI5_CL_CONF_ROUTE");
  assert.equal(session.state.models.MAIN.data.COUNT, 1);

  ({ session, app } = await open("Z2UI5_CL_CONF_NAV"));
  await tabTo(app, (w) => w.label === "Call");
  await app.key("enter");
  assert.match(app.print(), /^\[ < \] /);
  await app.key("alt-left");
  assert.equal(session.state.app, "Z2UI5_CL_CONF_NAV");

  const { execFile } = await import("node:child_process");
  const out = await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(ROOT, "renderers/terminal/bin/abap2ui5-tui.mjs"), url, "--app", "Z2UI5_CL_CONF_BIND", "--print", "--width", "80", "--no-color"], (e, stdout) => (e ? reject(e) : resolve(stdout)));
  });
  assert.equal(out, fs.readFileSync(path.join(ROOT, "renderers/terminal/golden/bind.txt"), "utf8"));
}

test("cap2ui5 passes every MUST but the pinned ones of the ui5 profile; its one warning is error.details", { skip: skipAll || (!capInstalled && "cap2UI5 host not installed - npm ci --prefix conformance/hosts/cap2ui5"), timeout: 600_000 }, async () => {
  const { startCap2ui5 } = await import("../conformance/hosts/cap2ui5/serve.mjs");
  const report = await suite(() => startCap2ui5(), "ui5");
  assert.deepEqual(report.results.filter((r) => r.status === "warn").map((r) => r.id), ["error.details"]);
});
