// The recorded traffic (traffic/<backend>/) of the two reference backends:
// every message validates (schema.test.mjs), every suite check passed when it
// was recorded but the pinned expected failures (test/lib/expected.mjs), and the two backends answered the same - see
// conformance/RESULTS.md for what differs and why.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load, comparable, normalizeIds } from "./lib/traffic.mjs";
import { BACKEND_EXPECTED_FAILURE_IDS } from "./lib/expected.mjs";

const node = load("node-runtime", "suite.json");
const cap = load("cap2ui5", "suite.json");

test("the suite traffic of both backends is recorded", () => {
  assert.ok(node, "traffic/node-runtime/suite.json");
  assert.ok(cap, "traffic/cap2ui5/suite.json");
});

test("no MUST check failed while the traffic was recorded but the pinned ones", () => {
  for (const s of [node, cap]) {
    assert.deepEqual(s.checks.filter((c) => c.status === "fail").map((c) => c.id), BACKEND_EXPECTED_FAILURE_IDS, `${s.backend}: ${JSON.stringify(s.counts)}`);
    assert.equal(s.counts.fail, BACKEND_EXPECTED_FAILURE_IDS.length, `${s.backend}: ${JSON.stringify(s.counts)}`);
  }
});

test("both backends ran the same checks with the same requests", () => {
  assert.deepEqual(cap.checks.map((c) => c.id), node.checks.map((c) => c.id));
  for (const c of node.checks) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(normalizeIds(o.exchanges.map((x) => x.label)), normalizeIds(c.exchanges.map((x) => x.label)), c.id);
  }
});

test("both backends answer every check identically (status, media type, JSON body; draft ids normalized)", () => {
  for (const c of node.checks) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(comparable(o), comparable(c), `${c.id} differs between node-runtime and cap2ui5`);
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
