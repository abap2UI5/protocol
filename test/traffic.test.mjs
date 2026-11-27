// The recorded traffic (traffic/<backend>/) of the reference backends: every
// message validates (schema.test.mjs), every suite check passed when it was
// recorded but the expected failures of the recording (test/lib/expected.mjs,
// RECORDED_FAILURES - the traffic is recorded with the node-runtime host on
// @abap2ui5/node-runtime 1.151.0 and the cap2UI5 host on
// @cap2ui5/cds-plugin 0.8.0, whatever is installed), and two backends
// answered the same wherever neither is pinned - see conformance/RESULTS.md
// for what differs and why. Were traffic/cap2ui5/suite.json missing, the
// comparisons below would be skipped with the reason expected.mjs gives
// (CAP_TRAFFIC_MISSING).
import assert from "node:assert/strict";
import { test } from "node:test";
import { load, comparable, normalizeIds } from "./lib/traffic.mjs";
import {
  recordedFailureIds as expectedFailureIds, recordedWarningIds as expectedWarningIds, BACKEND_TRAFFIC_APART, BACKEND_TRAFFIC_IDS_APART, CAP_TRAFFIC_MISSING, PROTOCOL,
} from "./lib/expected.mjs";

const node = load("node-runtime", "suite.json");
const cap = load("cap2ui5", "suite.json");

const noCap = cap ? false : CAP_TRAFFIC_MISSING;
const recordedBackends = () => [["node-runtime", node], ["cap2ui5", cap]].filter(([, s]) => s);

test("the suite traffic of both backends is recorded, on protocol 3; cap2UI5's is missing only for a pinned reason", () => {
  assert.ok(node, "traffic/node-runtime/suite.json");
  for (const [name, s] of recordedBackends()) {
    const start = s.checks.find((c) => c.id === "response.protocol").exchanges[0].response.body;
    assert.equal(start.S_FRONT.PROTOCOL, PROTOCOL, `${name}: the traffic is not of protocol ${PROTOCOL}`);
  }
  if (CAP_TRAFFIC_MISSING) assert.equal(cap, null, "traffic/cap2ui5/suite.json is there while expected.mjs says it is missing - set CAP_TRAFFIC_MISSING to null");
  else assert.ok(cap, "traffic/cap2ui5/suite.json is missing - record it (npm run record) or say why in CAP_TRAFFIC_MISSING (test/lib/expected.mjs)");
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
const idsApart = new Set(Object.keys(BACKEND_TRAFFIC_IDS_APART));
const shared = () => node.checks.filter((c) => !pinnedApart.has(c.id));
const sameIds = () => shared().filter((c) => !idsApart.has(c.id));

test("both backends ran the same checks, and the same requests in every check but the ones one of them is pinned on", { skip: noCap }, () => {
  assert.deepEqual(cap.checks.map((c) => c.id), node.checks.map((c) => c.id));
  for (const c of shared()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(normalizeIds(o.exchanges.map((x) => x.label)), normalizeIds(c.exchanges.map((x) => x.label)), c.id);
  }
});

test("both backends answer every check identically (status, media type, JSON body; draft ids normalized) but the ones one of them is pinned on", { skip: noCap }, () => {
  for (const c of sameIds()) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.deepEqual(comparable(o), comparable(c), `${c.id} differs between node-runtime and cap2ui5`);
  }
});

// Where each backend takes another branch the spec allows for the draft ids
// (expected.mjs, BACKEND_TRAFFIC_IDS_APART): the same with every id alike.
const anyId = (value) => JSON.parse(JSON.stringify(value).replace(/<ID\d+>/g, "<ID>"));
test("the checks answered alike but for the draft ids (BACKEND_TRAFFIC_IDS_APART) are identical with every draft id the same; cap2UI5 answers the unchanged timer tick with the id it continued - a declared timer running too -, the node-runtime host with a new one", { skip: noCap }, () => {
  assert.deepEqual([...idsApart], ["action.timer-declared", "session.timer-tick"]);
  for (const id of idsApart) {
    const n = node.checks.find((c) => c.id === id);
    const o = cap.checks.find((c) => c.id === id);
    assert.equal(n.status, "pass", `node-runtime ${id}`);
    assert.equal(o.status, "pass", `cap2ui5 ${id}`);
    assert.deepEqual(anyId(comparable(o)), anyId(comparable(n)), id);
  }
  const continued = (x) => x.request.body.value.S_FRONT.ID;
  for (const [id, label] of [["session.timer-tick", "tick NOOP"], ["action.timer-declared", "tick IDLE"]]) {
    const tick = (s) => s.checks.find((c) => c.id === id).exchanges.find((x) => x.label === label);
    assert.equal(tick(cap).response.body.S_FRONT.ID, continued(tick(cap)), `cap2ui5 ${id}`);
    assert.notEqual(tick(node).response.body.S_FRONT.ID, continued(tick(node)), `node-runtime ${id}`);
  }
});

test("the timer the backend keeps (spec/actions.md, MAY): both backends do all of it - every action.timer-declared* check passes, none skips", () => {
  for (const [name, s] of recordedBackends()) {
    const declared = s.checks.filter((c) => c.id.startsWith("action.timer-declared"));
    assert.equal(declared.length, 5, name);
    for (const c of declared) assert.equal(c.status, "pass", `${name} ${c.id}`);
  }
});

test("the windowed tables: both backends (@abap2ui5/node-runtime 1.151.0, and @cap2ui5/cds-plugin 0.8.0 on it) pass every check of them, the one behind a data reference included, and are compared above", { skip: noCap }, () => {
  const windowed = node.checks.filter((c) => c.id.startsWith("window."));
  assert.equal(windowed.length, 9);
  assert.deepEqual([...pinnedApart], []);
  for (const c of windowed) {
    const o = cap.checks.find((x) => x.id === c.id);
    assert.equal(c.status, "pass", `node-runtime ${c.id}`);
    assert.equal(o.status, "pass", `cap2ui5 ${c.id}`);
  }
});

test("the one recorded difference beyond the draft ids: cap2UI5 hides a JavaScript app's exception text (filed in conformance/RESULTS.md)", { skip: noCap }, () => {
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
