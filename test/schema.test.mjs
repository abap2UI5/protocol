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
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 2 } },
    { S_FRONT: { ID: "", APP: "A", PROTOCOL: 3 } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: {} } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: [["VIEW_SLOTS", "display", "MAIN", "<x/>"]] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { MAIN: "<x/>" } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { MAIN: {} } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { MAIN: { OPT: { navBack: true } } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { POPUP: { DESTROY: false } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { POPUP: { DESTROY: true, XML: "<x/>" } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { MAIN: { XML: 1 } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, NAV: {} } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, NAV: ["ROUTER", "sync", { setNavRouting: "KEEP" }] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, NAV: { setAppStateActive: false } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, ACTIONS: [] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, ACTIONS: ["[\"SET_FOCUS\",\"x\"]"] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, ACTIONS: [["MESSAGE_BOX", "shout", "x"]] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, ACTIONS: [["lower", "x"]] } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3 }, MODEL: [] },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3 }, MODEL: { T_ROWS: [], __WINDOW: { T_ROWS: { TOTAL: 3 } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3 }, MODEL: { T_ROWS: [], __WINDOW: { T_ROWS: { TOTAL: 3, COUNT: 3, SIZE: 0 } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3 }, MODEL: { S: { T_ROWS: [] }, __WINDOW: { S: { T_ROWS: { TOTAL: "3", COUNT: 3, SIZE: 3 } } } } },
  ],
  request: [
    { value: { S_FRONT: { ID: 7 } } },
    { value: { S_FRONT: { EVENT: "X", T_EVENT_ARG: "a" } } },
    { value: { S_FRONT: {} }, extra: 1 },
    { value: { S_FRONT: { UNKNOWN: 1 } } },
    { value: { MODEL: { T: { __delta: { a: { X: 1 } } } } } },
    { value: { MODEL: { MR_T: { "*": { __delta: { a: { X: 1 } } } } } } },
    { value: { MODEL: { MR_T: { "*": { __delta: { 0: { SUB: { __delta: [] } } } } } } } },
    { value: { S_FRONT: { MS_CLIENT_PREV: -1 } } },
    { value: { S_FRONT: { CONFIG: { S_DEVICE: { SYSTEM: "fridge" } } } } },
    { value: { S_FRONT: { ID: "X", EVENT: "___ZZZ_WIN" } } },
    { value: { S_FRONT: { EVENT: "___ZZZ_WIN", T_EVENT_ARG: ["/T_ROWS", "8"] } } },
    { value: { S_FRONT: { ID: "X", EVENT: "___ZZZ_WIN", T_EVENT_ARG: ["T_ROWS", "8"] } } },
    { value: { S_FRONT: { ID: "X", EVENT: "___ZZZ_WIN", T_EVENT_ARG: ["/T_ROWS", "4", [{ PATH: "QTY", DESCENDING: true }]] } } },
    { value: { S_FRONT: { ROUTE: {} } } },
    { value: { S_FRONT: { ROUTE: "#/app/Z2UI5_CL_X" } } },
    { value: { S_FRONT: { ROUTE: { DRAFT: "D" } } } },
    { value: { S_FRONT: { ROUTE: { APP: "" } } } },
    { value: { S_FRONT: { ROUTE: { APP: "Z2UI5_CL_X", HASH: "#/app/Z2UI5_CL_X" } } } },
  ],
  snapshot: [
    { snapshotVersion: 2 },
    {},
    windowed({ total: -1 }),
    windowed({ total: "12" }),
    windowed({ window: {} }),
    windowed({ window: { size: 0 } }),
    windowed({ window: { size: 4, more: true } }),
  ],
};

// hand-made messages that MUST validate - shapes the recorded traffic does
// not carry: the conformance apps bind no data reference
const VALID = {
  response: [
    // a section in any key order, an empty view, a slot torn down next to
    // one displayed, keys a later revision may add
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { POPOVER: { DESTROY: true }, MAIN: { XML: "" }, NEST: { XML: "<v/>", OPT: { id: "a", methodInsert: "addItem" } } } } },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, VIEWS: { MAIN: { XML: "<v/>", OPT: { futureOption: 1 }, FUTURE: 1 } }, NAV: { futureOption: true }, FUTURE: {} }, FUTURE: 1 },
    { S_FRONT: { ID: "X", APP: "A", PROTOCOL: 3, NAV: { setHashEvent: "HASH", setPushState: "/tab/2" }, ACTIONS: [["SET_FOCUS", "x"], ["CONTROL_BY_ID", "tab", "", "setBusy", { A: 1 }]] } },
  ],
  request: [
    { value: { S_FRONT: { ORIGIN: "http://h", PATHNAME: "/p", HASH: "#/app/Z2UI5_CL_X/D1", ROUTE: { APP: "Z2UI5_CL_X", DRAFT: "D1" } } } },
    { value: { S_FRONT: { HASH: "#Shell-display&/app//NS/CL_X", ROUTE: { APP: "/NS/CL_X" } } } },
    { value: { S_FRONT: { SEARCH: "?app_start=Z2UI5_CL_X", HASH: "#/z2ui5-xapp-state=D1", ROUTE: { APP_STATE: "D1" } } } },
    { value: { S_FRONT: { ID: "X", EVENT: "CHECK" }, MODEL: { MR_T: { "*": { __delta: { 2: { DONE: true } } } } } } },
    { value: { S_FRONT: { ID: "X", EVENT: "CHECK" }, MODEL: { MR_T: { "*": { __delta: { 0: { SUB: { __delta: { 1: { V: "x" } } } } } } } } } },
    { value: { S_FRONT: { ID: "X", EVENT: "CHECK" }, MODEL: { MR_T: { "*": [{ DONE: true }] }, MR_S: { "*": { A: 1 } }, MR_V: { "*": "x" } } } },
  ],
  snapshot: [],
};

/** A snapshot with one windowed table, its table keys overridden. */
function windowed(table) {
  return {
    snapshotVersion: 1, session: "X", app: "A", title: "", layer: "main", fields: [], actions: [],
    tables: [{
      id: "t1", path: "/T_ROWS", name: "T_ROWS", label: "T_ROWS", control: "sap.m.Table", columns: [],
      rowCount: 4, total: 12, rows: [], truncated: true, selectionMode: "None", editableCells: [], layer: "main",
      window: { size: 4 }, ...table,
    }],
    messages: [], texts: [], unsupported: [],
  };
}

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
    const all = [
      ...samples()[name],
      ...VALID[name].map((value, i) => ({ where: `valid #${i}`, value, expect: true })),
      ...INVALID[name].map((value, i) => ({ where: `invalid #${i}`, value, expect: false })),
    ];
    for (const { where, value, expect } of all) {
      const a = ajv(value);
      const m = mine(value).valid;
      assert.equal(m, a, `${where}: shipped validator says ${m}, ajv says ${a} (${JSON.stringify(ajv.errors).slice(0, 300)})`);
      assert.equal(m, expect, `${where}: expected ${expect ? "valid" : "invalid"}, ${JSON.stringify(mine(value).errors).slice(0, 300)}`);
    }
  });
}
