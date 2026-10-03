// The frontend suite: the scripted backend, the runner's classification,
// the check metadata, the vendored agent client, the CLI - and the suite
// against three real frontends:
//   agent  the agent client of abap2UI5/mcp-server (vendored, in process) -
//          always; its result is pinned check by check (RESULTS.md)
//   adaptive-cards  the Adaptive Cards renderer of this repository (in
//          process) - always; pinned the same way
//   ui5    the UI5 SPA of an abap2UI5 checkout in Chromium - when a checkout
//          (ABAP2UI5_HOME, ../abap2UI5, deps/abap2UI5) and a Chromium are
//          there; PROTOCOL_SKIP_BROWSER=1 skips it, PROTOCOL_REQUIRE_BROWSER=1
//          makes a missing browser or checkout a failure (CI's frontend job)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  runFrontendSuite, ALL_FRONTEND_CHECKS, startMock, payloadOf, Unsupported,
} from "../conformance/frontend/index.mjs";
import { locateWebapp } from "../conformance/frontend/adapters/ui5.mjs";
import { VENDOR_DIR, FILES, sha256 } from "../scripts/vendor-agent-client.mjs";
import { ROOT } from "./lib/traffic.mjs";

const CLI = path.join(ROOT, "conformance/backend/bin/abap2ui5-conformance.mjs");

test("the mock answers scripted replies in order, records requests and refuses the unscripted", async () => {
  const mock = await startMock();
  try {
    const run = mock.run();
    run.reply({ body: { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 2 } } });
    run.reply({ status: 500, body: "boom" });
    const post = (body) => fetch(run.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    let r = await post({ value: { S_FRONT: {} } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 2 } });
    r = await post({ value: { S_FRONT: { ID: "A" } } });
    assert.equal(r.status, 500);
    assert.equal(await r.text(), "boom");
    r = await post({ value: {} });
    assert.equal(r.status, 500);
    assert.equal(run.unexpected.length, 1);
    assert.deepEqual(payloadOf(run.posts()[1]), { S_FRONT: { ID: "A" } });
    // a new run closes the old endpoint: a late request is stray
    const next = mock.run();
    r = await post({});
    assert.equal(r.status, 410);
    assert.equal(mock.stray.length, 1);
    assert.notEqual(next.url, run.url);
  } finally {
    await mock.close();
  }
});

test("the mock plays a CSRF token layer and holds replies on request", async () => {
  const mock = await startMock();
  try {
    const run = mock.run().requireCsrf("tok");
    const held = run.replyHeld({ body: { S_FRONT: { ID: "B", APP: "X", PROTOCOL: 2 } } });
    let r = await fetch(run.url, { method: "POST", body: "{}" });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("x-csrf-token"), "Required");
    r = await fetch(run.url, { method: "HEAD", headers: { "x-csrf-token": "Fetch" } });
    assert.equal(r.headers.get("x-csrf-token"), "tok");
    const pending = fetch(run.url, { method: "POST", headers: { "x-csrf-token": "tok" }, body: "{}" });
    await held.received;
    assert.equal(run.inflight, 1);
    held.release();
    assert.equal((await pending).status, 200);
  } finally {
    await mock.close();
  }
});

/** A frontend in a few lines, for the runner tests: posts what the check asks. */
function fakeAdapter({ start = async (run) => { await fetch(run.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: { S_FRONT: { SEARCH: "?app_start=X" } } }) }); } } = {}) {
  return {
    name: "fake",
    profiles: ["core"],
    capabilities: new Set(),
    open: async () => {},
    start,
    fill: async () => { throw new Unsupported("cannot fill"); },
    press: async () => {},
    settle: async () => {},
    state: async () => ({}),
    stop: async () => {},
    close: async () => {},
  };
}

test("the runner tells pass, fail, warn and skip apart, and fails bad traffic", async () => {
  const ok = { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 2 } };
  const checks = [
    { id: "x.pass", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => { t.mock.reply({ body: ok }); await t.start("X"); t.equal(t.front(0).SEARCH, "?app_start=X", "SEARCH"); } },
    { id: "x.fail", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => t.fail("broken") },
    { id: "x.warn", title: "", level: "SHOULD", profile: "core", spec: "", run: async (t) => t.equal(1, 2, "one") },
    { id: "x.unsupported", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => t.fill({ path: "/X" }, 1) },
    { id: "x.needs", title: "", level: "MUST", profile: "core", spec: "", needs: ["dom"], run: async (t) => t.fail("never") },
    { id: "x.profile", title: "", level: "MUST", profile: "ui5", spec: "", run: async (t) => t.fail("never") },
    { id: "x.unexpected", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => { await t.start("X"); } },
  ];
  const r = await runFrontendSuite({ adapter: fakeAdapter(), checks, profile: "core" });
  assert.deepEqual(r.results.map((x) => x.status), ["pass", "fail", "warn", "skip", "skip", "skip", "fail"]);
  assert.match(r.results[6].message, /more than the script expected/);
  assert.equal(r.ok, false);

  const bad = await runFrontendSuite({
    adapter: fakeAdapter({ start: async (run) => { await fetch(run.url, { method: "POST", body: JSON.stringify({ value: { S_FRONT: { NOT_A_KEY: 1 } } }) }); } }),
    checks: [{ id: "x.schema", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => { t.mock.reply({ body: ok }); await t.start("X"); } }],
  });
  assert.equal(bad.results[0].status, "fail");
  assert.match(bad.results[0].message, /schema\/request\.schema\.json/);
});

test("an adapter that cannot start skips every check and the report says why", async () => {
  const a = fakeAdapter();
  a.open = async () => { throw new Unsupported("nothing to drive"); };
  const r = await runFrontendSuite({ adapter: a, checks: ALL_FRONTEND_CHECKS.slice(0, 2), profile: "core" });
  assert.deepEqual(r.results.map((x) => x.status), ["skip", "skip"]);
  assert.equal(r.error, "nothing to drive");
  assert.equal(r.ok, false);
});

test("frontend checks: unique ids, levels, profiles, known capabilities", () => {
  const ids = ALL_FRONTEND_CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const caps = new Set(["dom", "url", "timers", "focus", "concurrent", "modelEdit", "boxClose", "nest", "snapshot", "title", "wires"]);
  for (const c of ALL_FRONTEND_CHECKS) {
    assert.ok(["MUST", "SHOULD"].includes(c.level), c.id);
    assert.ok(["core", "portable", "ui5", "semantic"].includes(c.profile), c.id);
    for (const n of c.needs || []) assert.ok(caps.has(n), `${c.id}: unknown capability ${n}`);
  }
  assert.ok(ALL_FRONTEND_CHECKS.length >= 75, `${ALL_FRONTEND_CHECKS.length}`);
});

test("the vendored agent client is byte-equal to the commit source.json names", () => {
  const src = JSON.parse(fs.readFileSync(path.join(VENDOR_DIR, "source.json"), "utf8"));
  for (const f of FILES) {
    const name = path.basename(f);
    const text = fs.readFileSync(path.join(VENDOR_DIR, name), "utf8");
    assert.equal(sha256(text), src.files[name].sha256, `${name} was edited - re-vendor with npm run vendor:agent`);
    assert.ok(text.startsWith(`/*\n * VENDORED - do not edit. abap2UI5/mcp-server ${f} at commit ${src.commit}`), name);
  }
});

test("the CLI runs the frontend suite and refuses an unknown adapter", () => {
  const r = spawnSync(process.execPath, [CLI, "frontend", "--adapter", "agent", "--only", "request.envelope"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS\s+MUST\s+request\.envelope/);
  assert.match(r.stdout, /CONFORMANT \(profile semantic\)/);
  assert.equal(spawnSync(process.execPath, [CLI, "frontend", "--adapter", "nope"]).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, "frontend", "--adapter", "headless"]).status, 2);
  const json = JSON.parse(execFileSync(process.execPath, [CLI, "frontend", "--adapter", "agent", "--only", "request.app-start", "--json"], { encoding: "utf8" }));
  assert.equal(json.adapter, "agent");
  assert.ok(json.results.every((x) => x.status === "pass"));
});

// The agent client's result, check by check - a change here is a change of
// the client (re-vendored) or of a check. Since mcp-server a4d9f07 (PR #44)
// it follows every frontend rule that applies (conformance/RESULTS.md); the
// skips are the portable and UI5 profiles it does not claim, a URL, a DOM,
// focus, programmatic model edits and the nested-table cell its snapshot
// does not describe.
const AGENT_SKIPS = [
  "model.nested-table", "model.whole-beats-delta", "action.after-render", "message.details-sanitized",
  "router.keep", "router.hash-sent", "router.back-restores", "router.app-state",
  "portable.default-aggregation", "portable.unknown-property", "portable.unknown-control", "portable.excluded-action",
  "portable.box-details", "portable.timer", "portable.set-title", "portable.view-replaced",
  "ui5.wire-ebp", "ui5.wire-source-argument", "ui5.wire-queue-last", "ui5.nest",
];

test("the agent client: the frontend suite's result is the one RESULTS.md records", { timeout: 120_000 }, async () => {
  const r = await runFrontendSuite({ adapter: "agent" });
  assert.equal(r.profile, "semantic");
  const bad = r.results.filter((x) => x.status === "fail" || x.status === "warn");
  assert.deepEqual(bad.map((x) => `${x.id}: ${x.message}`), []);
  assert.deepEqual(r.results.filter((x) => x.status === "skip").map((x) => x.id), AGENT_SKIPS);
});

// The Adaptive Cards renderer of this repository (renderers/adaptive-cards/):
// every check it can be driven through holds; the skips are what a card has
// not (a URL, a DOM, focus, a document title, programmatic model edits) and
// the profiles it does not claim.
const CARDS_SKIPS = [
  "model.whole-beats-delta", "action.after-render", "message.details-sanitized",
  "router.keep", "router.hash-sent", "router.back-restores", "router.app-state", "portable.box-details", "portable.set-title",
  "ui5.wire-ebp", "ui5.wire-source-argument", "ui5.wire-queue-last", "ui5.nest",
  "semantic.snapshot-schema", "semantic.recorded-snapshots", "semantic.timer-action",
];

test("the Adaptive Cards renderer: every portable-profile check it can be driven through holds", { timeout: 120_000 }, async () => {
  const r = await runFrontendSuite({ adapter: "adaptive-cards" });
  assert.equal(r.profile, "portable");
  const bad = r.results.filter((x) => x.status === "fail" || x.status === "warn");
  assert.deepEqual(bad.map((x) => `${x.id}: ${x.message}`), []);
  assert.deepEqual(r.results.filter((x) => x.status === "skip").map((x) => x.id), CARDS_SKIPS);
  if (process.env.PROTOCOL_CARDS_REPORT) fs.writeFileSync(process.env.PROTOCOL_CARDS_REPORT, `${JSON.stringify(r, null, 2)}\n`);
});

const skipBrowser = process.env.PROTOCOL_SKIP_BROWSER ? "PROTOCOL_SKIP_BROWSER is set" : false;
// The UI5 SPA's one deviation (RESULTS.md): message box details stay empty on
// OpenUI5 >= 1.120. The fix is under way in abap2UI5 (open question 7, decided
// in revision 0.3: expanded), so a checkout that carries it passes the check -
// the pin accepts both; every other failure fails the test.
const UI5_KNOWN_FAILS = ["portable.box-details"];

test("the UI5 SPA in Chromium: every MUST but the recorded deviation holds", { skip: skipBrowser, timeout: 900_000 }, async (t) => {
  if (!locateWebapp()) {
    if (process.env.PROTOCOL_REQUIRE_BROWSER) assert.fail("no abap2UI5 checkout with app/webapp (ABAP2UI5_HOME)");
    t.skip("no abap2UI5 checkout with app/webapp (ABAP2UI5_HOME, ../abap2UI5 or deps/abap2UI5)");
    return;
  }
  const r = await runFrontendSuite({ adapter: "ui5" });
  if (r.error) {
    if (process.env.PROTOCOL_REQUIRE_BROWSER) assert.fail(r.error);
    t.skip(r.error);
    return;
  }
  const failed = r.results.filter((x) => x.status === "fail");
  const unknown = failed.filter((x) => !UI5_KNOWN_FAILS.includes(x.id));
  assert.deepEqual(unknown.map((x) => x.id), [], unknown.map((x) => `${x.id}: ${x.message}`).join("\n"));
  for (const id of UI5_KNOWN_FAILS) if (!failed.some((x) => x.id === id)) t.diagnostic(`${id} passes - this checkout carries the fix; unpin it once CI's abap2UI5 commit does`);
  assert.deepEqual(r.results.filter((x) => x.status === "warn").map((x) => `${x.id}: ${x.message}`), []);
  if (process.env.PROTOCOL_FRONTEND_REPORT) fs.writeFileSync(process.env.PROTOCOL_FRONTEND_REPORT, `${JSON.stringify(r, null, 2)}\n`);
});
