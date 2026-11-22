// The recorded traffic (traffic/<backend>/) of the reference backends: every
// message validates (schema.test.mjs), every suite check passed when it was
// recorded but the expected failures of the recording (test/lib/expected.mjs,
// RECORDED_FAILURES - the traffic is recorded with the node-runtime host on
// a runtime packed from abap2UI5 DEV, whatever is installed), and two
// backends answered the same wherever neither is pinned - see
// conformance/RESULTS.md for what differs and why.
//
// Protocol 3: no traffic of cap2UI5 is recorded - @cap2ui5/cds-plugin 0.7.0
// speaks protocol 2 (expected.mjs, CAP_TRAFFIC_MISSING). The comparisons
// below are skipped with that reason and run again as soon as
// traffic/cap2ui5/suite.json is there.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load, comparable, normalizeIds } from "./lib/traffic.mjs";
import {
  recordedFailureIds as expectedFailureIds, recordedWarningIds as expectedWarningIds, BACKEND_TRAFFIC_APART, CAP_TRAFFIC_MISSING, PROTOCOL,
} from "./lib/expected.mjs";

const node = load("node-runtime", "suite.json");
const cap = load("cap2ui5", "suite.json");

const noCap = cap ? false : CAP_TRAFFIC_MISSING;
const recordedBackends = () => [["node-runtime", node], ["cap2ui5", cap]].filter(([, s]) => s);

test("the suite traffic of node-runtime is recorded, on protocol 3; cap2UI5's is missing for the pinned reason only", () => {
  assert.ok(node, "traffic/node-runtime/suite.json");
  for (const [name, s] of recordedBackends()) {
    const start = s.checks.find((c) => c.id === "response.protocol").exchanges[0].response.body;
    assert.equal(start.S_FRONT.PROTOCOL, PROTOCOL, `${name}: the traffic is not of protocol ${PROTOCOL}`);
  }
  assert.ok(CAP_TRAFFIC_MISSING, "traffic/cap2ui5 is recorded again - set CAP_TRAFFIC_MISSING to null (test/lib/expected.mjs)");
  assert.equal(cap, null, "traffic/cap2ui5/suite.json is there while expected.mjs says it is missing - unpin CAP_TRAFFIC_MISSING");
});

test("no MUST check failed while the traffic was recorded but the pinned ones", () => {
  for (const [name, s] of recordedBackends()) {
    assert.deepEqual(s.checks.filter((c) => c.status === "fail").map((c) => c.id), expectedFailureIds(name), `${s.backend}: ${JSON.stringify(s.counts)}`);
    assert.equal(s.counts.fail, expectedFailureIds(name).length, `${s.backend}: ${JSON.stringify(s.counts)}`);
    assert.deepEqual(s.checks.filter((c) => c.status === "warn").map((c) => c.id), expectedWarningIds(name), `${s.backend}: ${JSON.stringify(s.counts)}`);
  }
});

// The checks one backend never gets into (test/lib/expected.mjs): their
// traffic differs by what the pin says, and is compared again once it is gone.
const pinnedApart = new Set(BACKEND_TRAFFIC_APART);
const shared = () => node.checks.filter((c) => !pinnedApart.has(c.id));

test("both backends ran the same checks, and the same requests in every check but the ones one of them is pinned on", { skip: noCap }, () => {
  assert.deepEqual(cap.checks.map((c) => c.id), node.checks.map((c) => c.id));
  for (const c of shared()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(normalizeIds(o.exchanges.map((x) => x.label)), normalizeIds(c.exchanges.map((x) => x.label)), c.id);
  }
});

test("both backends answer every check identically (status, media type, JSON body; draft ids normalized) but the ones one of them is pinned on", { skip: noCap }, () => {
  for (const c of shared()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(comparable(o), comparable(c), `${c.id} differs between node-runtime and cap2ui5`);
  }
});

test("the windowed tables: node-runtime (recorded on a runtime of abap2UI5 main 694fb262) passes every check of them, the one behind a data reference included; cap2ui5 fails each on the app's start, as pinned, and only they are kept out of the comparison above", { skip: noCap }, () => {
  const windowed = node.checks.filter((c) => c.id.startsWith("window."));
  assert.equal(windowed.length, 9);
  assert.deepEqual([...pinnedApart].sort(), windowed.map((c) => c.id).sort());
  for (const c of windowed) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.equal(c.status, "pass", `node-runtime ${c.id}`);
    assert.equal(o.status, expectedWarningIds("cap2ui5").includes(c.id) ? "warn" : "fail", `cap2ui5 ${c.id}`);
    // the app's start, answered 500 - the one exchange of the check
    assert.equal(o.exchanges.length, 1, c.id);
    assert.equal(o.exchanges[0].response.status, 500, c.id);
  }
});

test("the one recorded difference: cap2UI5 hides a JavaScript app's exception text (filed in conformance/RESULTS.md)", { skip: noCap }, () => {
  const status = (s) => s.checks.find((c) => c.id === "error.details").status;
  assert.equal(status(node), "pass");
  assert.equal(status(cap), "warn");
  const body = (s) => s.checks.find((c) => c.id === "error.app-exception").exchanges.at(-1).response.body;
  assert.match(body(node), /Z2UI5_CL_CONF_ERROR/);
  assert.match(body(cap), /^roundtrip failed \(/);
});

test("tables behind a data reference (open question 14): both backends pass model.reference-delta - cap2UI5 since @cap2ui5/cds-plugin 0.7.0 and its t.ref( ) - and answer it identically (compared above); the windowed one is window.delta-rows-reference, above", { skip: noCap }, () => {
  for (const id of ["model.reference-delta"]) {
    const n = node.checks.find((c) => c.id === id);
    const o = cap.checks.find((c) => c.id === id);
    assert.equal(n.status, "pass", `node-runtime ${id}`);
    assert.equal(o.status, "pass", `cap2ui5 ${id}`);
    assert.ok(!pinnedApart.has(id), `${id} is compared between the backends`);
    assert.equal(o.exchanges.length, n.exchanges.length, id);
  }
});
