// The recorded traffic (traffic/<backend>/) of the two reference backends:
// every message validates (schema.test.mjs), every suite check passed when it
// was recorded but the pinned expected failures (test/lib/expected.mjs, per
// backend), and the two backends answered the same wherever neither is pinned - see
// conformance/RESULTS.md for what differs and why.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load, comparable, normalizeIds } from "./lib/traffic.mjs";
import { expectedFailureIds, expectedWarningIds, BACKEND_TRAFFIC_APART } from "./lib/expected.mjs";

const node = load("node-runtime", "suite.json");
const cap = load("cap2ui5", "suite.json");

test("the suite traffic of both backends is recorded", () => {
  assert.ok(node, "traffic/node-runtime/suite.json");
  assert.ok(cap, "traffic/cap2ui5/suite.json");
});

test("no MUST check failed while the traffic was recorded but the pinned ones", () => {
  for (const [name, s] of [["node-runtime", node], ["cap2ui5", cap]]) {
    assert.deepEqual(s.checks.filter((c) => c.status === "fail").map((c) => c.id), expectedFailureIds(name), `${s.backend}: ${JSON.stringify(s.counts)}`);
    assert.equal(s.counts.fail, expectedFailureIds(name).length, `${s.backend}: ${JSON.stringify(s.counts)}`);
    assert.deepEqual(s.checks.filter((c) => c.status === "warn").map((c) => c.id), expectedWarningIds(name), `${s.backend}: ${JSON.stringify(s.counts)}`);
  }
});

// The checks one backend never gets into (test/lib/expected.mjs): their
// traffic differs by what the pin says, and is compared again once it is gone.
const pinnedApart = new Set(BACKEND_TRAFFIC_APART);
const shared = () => node.checks.filter((c) => !pinnedApart.has(c.id));

test("both backends ran the same checks, and the same requests in every check but the ones one of them is pinned on", () => {
  assert.deepEqual(cap.checks.map((c) => c.id), node.checks.map((c) => c.id));
  for (const c of shared()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(normalizeIds(o.exchanges.map((x) => x.label)), normalizeIds(c.exchanges.map((x) => x.label)), c.id);
  }
});

test("both backends answer every check identically (status, media type, JSON body; draft ids normalized) but the ones one of them is pinned on", () => {
  for (const c of shared()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(comparable(o), comparable(c), `${c.id} differs between node-runtime and cap2ui5`);
  }
});

test("the windowed tables: node-runtime passes every check of them; cap2ui5 fails each on the app's start, as pinned, and only they are kept out of the comparison above", () => {
  const windowed = node.checks.filter((c) => c.id.startsWith("window."));
  assert.equal(windowed.length, 8);
  assert.deepEqual([...pinnedApart], windowed.map((c) => c.id));
  for (const c of windowed) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.equal(c.status, "pass", `node-runtime ${c.id}`);
    assert.equal(o.status, expectedWarningIds("cap2ui5").includes(c.id) ? "warn" : "fail", `cap2ui5 ${c.id}`);
    // the app's start, answered 500 - the one exchange of the check
    assert.equal(o.exchanges.length, 1, c.id);
    assert.equal(o.exchanges[0].response.status, 500, c.id);
  }
});

test("the one recorded difference: cap2UI5 hides a JavaScript app's exception text (filed in conformance/RESULTS.md)", () => {
  const status = (s) => s.checks.find((c) => c.id === "error.details").status;
  assert.equal(status(node), "pass");
  assert.equal(status(cap), "warn");
  const body = (s) => s.checks.find((c) => c.id === "error.app-exception").exchanges.at(-1).response.body;
  assert.match(body(node), /Z2UI5_CL_CONF_ERROR/);
  assert.match(body(cap), /^roundtrip failed \(/);
});
