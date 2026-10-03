// The schemas, and the zero-dependency validator the suite ships, against
// ajv - the reference implementation of draft 2020-12 - over every recorded
// message: the two must agree, and the schemas must compile in strict mode.
import assert from "node:assert/strict";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { compile, loadSchema } from "../conformance/backend/lib/schema.mjs";
import { backends, exchanges, load } from "./lib/traffic.mjs";

const NAMES = ["request", "response", "snapshot", "portable-profile"];

function ajvFor(name) {
  const ajv = new Ajv2020({ strict: true, allErrors: true, strictTuples: false, allowUnionTypes: true });
  return ajv.compile(loadSchema(name));
}

test("every schema compiles in ajv's strict mode and in the shipped validator", () => {
  for (const name of NAMES) {
    assert.doesNotThrow(() => ajvFor(name), `${name}.schema.json in ajv`);
    assert.doesNotThrow(() => compile(loadSchema(name)), `${name}.schema.json in the shipped validator`);
  }
});

function samples() {
  const out = { request: [], response: [], snapshot: [] };
  for (const b of backends()) {
    for (const x of exchanges(b)) {
      if (x.request.method === "POST" && x.request.body && typeof x.request.body === "object") {
        out.request.push({ where: `${b} ${x.source} ${x.label}`, value: x.request.body, expect: !x.malformed });
      }
      const r = x.response;
      if (r.status >= 200 && r.status < 300 && r.body && typeof r.body === "object") {
        out.response.push({ where: `${b} ${x.source} ${x.label}`, value: r.body, expect: true });
      }
    }
    const agent = load(b, "agent-client.json");
    for (const s of (agent && agent.snapshots) || []) out.snapshot.push({ where: `${b} ${s.label}`, value: s.snapshot, expect: true });
  }
  return out;
}

// hand-made messages that must NOT validate - so agreement is not just
// "both accept everything"
const INVALID = {
  response: [
    {},
    { S_FRONT: { ID: "X", APP: "A" } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 1 } },
    { S_FRONT: { ID: "", APP: "A", PROTOCOL: 2 } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_SYSTEM: [["VIEW_SLOTS", "display", "SIDEBAR", "<x/>"]] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_SYSTEM: [["VIEW_SLOTS", "destroy"]] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_SYSTEM: [["ROUTER", "sync", {}]] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_SYSTEM: ["[\"VIEW_SLOTS\",\"destroy\",\"POPUP\"]"] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_CUSTOM: [["MESSAGE_BOX", "shout", "x"]] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2, S_ACTION: { T_CUSTOM: [["lower", "x"]] } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2 }, MODEL: [] },
  ],
  request: [
    { value: { S_FRONT: { ID: 7 } } },
    { value: { S_FRONT: { EVENT: "X", T_EVENT_ARG: "a" } } },
    { value: { S_FRONT: {} }, extra: 1 },
    { value: { S_FRONT: { UNKNOWN: 1 } } },
    { value: { MODEL: { T: { __delta: { a: { X: 1 } } } } } },
    { value: { S_FRONT: { MS_CLIENT_PREV: -1 } } },
    { value: { S_FRONT: { CONFIG: { S_DEVICE: { SYSTEM: "fridge" } } } } },
  ],
  snapshot: [{ snapshotVersion: 2 }, {}],
};

test("recorded traffic exists for at least one backend", () => {
  const s = samples();
  assert.ok(s.request.length > 50, `requests: ${s.request.length}`);
  assert.ok(s.response.length > 50, `responses: ${s.response.length}`);
  assert.ok(s.snapshot.length > 0, `snapshots: ${s.snapshot.length}`);
});

for (const name of ["request", "response", "snapshot"]) {
  test(`${name}: the shipped validator and ajv agree on every recorded and every invalid message`, () => {
    const ajv = ajvFor(name);
    const mine = compile(loadSchema(name));
    const all = [...samples()[name], ...INVALID[name].map((value, i) => ({ where: `invalid #${i}`, value, expect: false }))];
    for (const { where, value, expect } of all) {
      const a = ajv(value);
      const m = mine(value).valid;
      assert.equal(m, a, `${where}: shipped validator says ${m}, ajv says ${a} (${JSON.stringify(ajv.errors).slice(0, 300)})`);
      assert.equal(m, expect, `${where}: expected ${expect ? "valid" : "invalid"}, ${JSON.stringify(mine(value).errors).slice(0, 300)}`);
    }
  });
}
