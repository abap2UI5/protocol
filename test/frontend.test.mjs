// The frontend suite: the scripted backend, the runner's classification,
// the check metadata, the vendored agent client, the CLI - and the suite
// against three real frontends:
//   agent  the agent client of abap2UI5/mcp-server (vendored, in process) -
//          always; its result is pinned check by check (RESULTS.md)
//   adaptive-cards  the Adaptive Cards renderer of this repository (in
//          process) - always; pinned the same way
//   terminal  the terminal renderer of this repository (in process, driven
//          with keys) - always; pinned the same way
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
import { behind, SPEAKS, PROTOCOL, BEHIND_FRONTEND_CHECK, frontendProtocol } from "./lib/expected.mjs";

const CLI = path.join(ROOT, "conformance/backend/bin/abap2ui5-conformance.mjs");

test("the mock answers scripted replies in order, records requests and refuses the unscripted", async () => {
  const mock = await startMock();
  try {
    const run = mock.run();
    run.reply({ body: { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 3 } } });
    run.reply({ status: 500, body: "boom" });
    const post = (body) => fetch(run.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    let r = await post({ value: { S_FRONT: {} } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 3 } });
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
    const held = run.replyHeld({ body: { S_FRONT: { ID: "B", APP: "X", PROTOCOL: 3 } } });
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
  const ok = { S_FRONT: { ID: "A", APP: "X", PROTOCOL: 3 } };
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
  const r = spawnSync(process.execPath, [CLI, "frontend", "--adapter", "terminal", "--only", "request.envelope"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS\s+MUST\s+request\.envelope/);
  assert.match(r.stdout, /CONFORMANT \(profile portable\)/);
  assert.equal(spawnSync(process.execPath, [CLI, "frontend", "--adapter", "nope"]).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, "frontend", "--adapter", "headless"]).status, 2);
  const json = JSON.parse(execFileSync(process.execPath, [CLI, "frontend", "--adapter", "terminal", "--only", "request.app-start", "--json"], { encoding: "utf8" }));
  assert.equal(json.adapter, "terminal");
  assert.ok(json.results.every((x) => x.status === "pass"));
});

// The agent client's result, check by check - a change here is a change of
// the client (re-vendored) or of a check. From mcp-server a4d9f07 (PR #44)
// it followed every frontend rule that applies, until the windowed tables
// became app-driven (conformance/RESULTS.md, below) - the vendored copy is
// 332a0b0 (adapters/vendor/mcp-server/source.json); the
// skips are the portable and UI5 profiles it does not claim, a URL, a DOM,
// focus, programmatic model edits and the nested-table cell its snapshot
// does not describe.
const AGENT_SKIPS = [
  "model.nested-table", "model.whole-beats-delta", "ui5.window-growth", "ui5.window-sort-filter", "ui5.window-no-event",
  "action.after-render", "message.details-sanitized",
  "router.keep", "router.hash-sent", "router.back-restores", "router.app-state",
  "router.start-route", "router.start-app-state", "router.no-route-on-events", "router.hash-write-owner",
  "portable.default-aggregation", "portable.unknown-property", "portable.unknown-control", "portable.excluded-action",
  "portable.box-details", "portable.timer", "portable.set-title", "portable.view-replaced",
  "ui5.wire-ebp", "ui5.wire-source-argument", "ui5.wire-queue-last", "ui5.nest",
];

// Its known deviation (RESULTS.md, windowed tables), with the place of the
// fix: the client sends the window request of abap2UI5 1.149.0 and 1.150.0
// ([path, count, sort?, filter?]), which is no request of this revision -
// the replay of the "Sort list" BINDING_CALL posts one. Fixed in
// abap2UI5/mcp-server lib/appclient.mjs (window requests as [path, event,
// reason, skip, top, sorters, filter groups]), then re-vendored.
const AGENT_KNOWN_FAILS = ["semantic.recorded-snapshots"];

// Protocol 3: the vendored client speaks protocol 2 and refuses every
// response of this revision - it is BEHIND (test/lib/expected.mjs) and
// measured by the one check that says so, pinned as its failure. What it sends is still a request of this revision
// (the app start names its class in SEARCH; it has no URL, so no ROUTE).
// The check-by-check pin above applies again with the first vendored copy
// on protocol 3 (abap2UI5/mcp-server lib/appclient.mjs: read VIEWS, NAV and
// ACTIONS, the options object of a wire; then npm run vendor:agent and
// npm run record).
test(`the agent client (protocol ${SPEAKS.agent})${behind("agent") ? ` is behind protocol ${PROTOCOL}: it refuses a response of this revision` : ": the frontend suite's result is the one RESULTS.md records"}`, { timeout: 120_000 }, async () => {
  if (behind("agent")) {
    // `only` filters by substring: the two checks by their exact ids
    const exact = ["request.app-start", BEHIND_FRONTEND_CHECK];
    const r = await runFrontendSuite({ adapter: "agent", only: exact });
    r.results = r.results.filter((x) => exact.includes(x.id));
    assert.deepEqual(r.results.map((x) => `${x.id} ${x.status}`), ["request.app-start pass", `${BEHIND_FRONTEND_CHECK} fail`]);
    // nothing of the response was adopted
    assert.match(r.results.find((x) => x.status === "fail").message, /MAIN is not open/);
    return;
  }
  const r = await runFrontendSuite({ adapter: "agent" });
  assert.equal(r.profile, "semantic");
  const bad = r.results.filter((x) => x.status === "fail" || x.status === "warn");
  assert.deepEqual(bad.map((x) => x.id), AGENT_KNOWN_FAILS, bad.map((x) => `${x.id}: ${x.message}`).join("\n"));
  for (const x of bad) assert.match(x.message, /___ZZZ_WIN.*"T_EVENT_ARG":\["\/T_ROWS","4",/, x.id);
  assert.deepEqual(r.results.filter((x) => x.status === "skip").map((x) => x.id), AGENT_SKIPS);
});

// The Adaptive Cards renderer of this repository (renderers/adaptive-cards/):
// every check it can be driven through holds; the skips are what a card has
// not (a URL, a DOM, focus, a document title, programmatic model edits) and
// the profiles it does not claim.
const CARDS_SKIPS = [
  "model.whole-beats-delta", "ui5.window-growth", "ui5.window-sort-filter", "ui5.window-no-event", "action.after-render", "message.details-sanitized",
  "router.keep", "router.hash-sent", "router.back-restores", "router.app-state",
  "router.start-route", "router.start-app-state", "router.no-route-on-events", "router.hash-write-owner", "portable.set-title",
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

// The terminal renderer of this repository (renderers/terminal/), driven
// with keys through its state machine: every check it can be driven through
// holds - the router checks too (it keeps a hash history); the skips are
// what a terminal has not (a DOM, programmatic model edits) and the
// profiles it does not claim.
const TERMINAL_SKIPS = [
  "model.whole-beats-delta", "ui5.window-growth", "ui5.window-sort-filter", "ui5.window-no-event", "message.details-sanitized",
  "ui5.wire-ebp", "ui5.wire-source-argument", "ui5.wire-queue-last", "ui5.nest",
  "semantic.snapshot-schema", "semantic.recorded-snapshots", "semantic.timer-action",
];

test("the terminal renderer: every portable-profile check it can be driven through holds", { timeout: 120_000 }, async () => {
  const r = await runFrontendSuite({ adapter: "terminal" });
  assert.equal(r.profile, "portable");
  const bad = r.results.filter((x) => x.status === "fail" || x.status === "warn");
  assert.deepEqual(bad.map((x) => `${x.id}: ${x.message}`), []);
  assert.deepEqual(r.results.filter((x) => x.status === "skip").map((x) => x.id), TERMINAL_SKIPS);
  if (process.env.PROTOCOL_TERMINAL_REPORT) fs.writeFileSync(process.env.PROTOCOL_TERMINAL_REPORT, `${JSON.stringify(r, null, 2)}\n`);
});

const skipBrowser = process.env.PROTOCOL_SKIP_BROWSER ? "PROTOCOL_SKIP_BROWSER is set" : false;
// The UI5 SPA's known deviations (RESULTS.md) - a deviation goes here with
// the place of its fix; every other failure fails the test.
// window.edit-as-delta-reference (a cell behind a data reference sent as the
// whole attribute) was pinned while CI's abap2UI5 commit was the release
// 1.149.0; fixed in abap2UI5 2cc0344 (#3026), released with 1.150.0.
// The three UI5-profile checks of the app-driven window fail on a frontend
// whose list binding sends the window request of 1.149.0 and 1.150.0 - the
// release commit af05dce CI checks out; fixed in abap2UI5 main 694fb262
// (#3032, core/WindowModel.js), the next release after 1.150.0. Pinned only
// for such a checkout: one whose core/WindowModel.js names the reasons of
// the app-driven window passes them.
const WINDOW_UI5 = ["ui5.window-growth", "ui5.window-sort-filter", "ui5.window-no-event"];
const appDrivenFrontend = (webapp) => {
  const file = webapp && path.join(webapp, "core", "WindowModel.js");
  return !file || !fs.existsSync(file) || /\bREASON\b/.test(fs.readFileSync(file, "utf8"));
};
const UI5_KNOWN_FAILS = appDrivenFrontend(locateWebapp()) ? [] : WINDOW_UI5;
// Protocol 3: a checkout before it - the release commit CI's frontend job
// checks out - is BEHIND (test/lib/expected.mjs): it refuses every response
// of this revision, and is measured by the one check that says so. The
// whole suite runs against a checkout of abap2UI5 DEV, as abap2UI5's own CI
// runs it (its job conformance_frontend).
const ui5Speaks = frontendProtocol(locateWebapp());
const ui5Behind = Boolean(locateWebapp()) && ui5Speaks !== PROTOCOL;

test(`the UI5 SPA in Chromium${ui5Behind ? ` (protocol ${ui5Speaks}) is behind protocol ${PROTOCOL}: it refuses a response of this revision` : ": every MUST but the recorded deviation holds"}`, { skip: skipBrowser, timeout: 900_000 }, async (t) => {
  if (!locateWebapp()) {
    if (process.env.PROTOCOL_REQUIRE_BROWSER) assert.fail("no abap2UI5 checkout with app/webapp (ABAP2UI5_HOME)");
    t.skip("no abap2UI5 checkout with app/webapp (ABAP2UI5_HOME, ../abap2UI5 or deps/abap2UI5)");
    return;
  }
  const r = await runFrontendSuite({ adapter: "ui5", ...(ui5Behind ? { only: [BEHIND_FRONTEND_CHECK] } : {}) });
  if (r.error) {
    if (process.env.PROTOCOL_REQUIRE_BROWSER) assert.fail(r.error);
    t.skip(r.error);
    return;
  }
  if (ui5Behind) {
    // `only` filters by substring: the check by its exact id
    r.results = r.results.filter((x) => x.id === BEHIND_FRONTEND_CHECK);
    assert.deepEqual(r.results.map((x) => `${x.id} ${x.status}`), [`${BEHIND_FRONTEND_CHECK} fail`]);
    if (process.env.PROTOCOL_FRONTEND_REPORT) fs.writeFileSync(process.env.PROTOCOL_FRONTEND_REPORT, `${JSON.stringify(r, null, 2)}\n`);
    return;
  }
  const failed = r.results.filter((x) => x.status === "fail");
  const unknown = failed.filter((x) => !UI5_KNOWN_FAILS.includes(x.id));
  assert.deepEqual(unknown.map((x) => x.id), [], unknown.map((x) => `${x.id}: ${x.message}`).join("\n"));
  assert.deepEqual(UI5_KNOWN_FAILS.filter((id) => !failed.some((x) => x.id === id)), [], "pinned checks that pass now - unpin them");
  assert.deepEqual(r.results.filter((x) => x.status === "warn").map((x) => `${x.id}: ${x.message}`), []);
  if (process.env.PROTOCOL_FRONTEND_REPORT) fs.writeFileSync(process.env.PROTOCOL_FRONTEND_REPORT, `${JSON.stringify(r, null, 2)}\n`);
});
