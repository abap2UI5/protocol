// spec/response.md - the response envelope, its version stamp and MODEL.
const R = "spec/response.md";
import { displays, displayOf, hasModel, systemActions, customActions } from "../client.mjs";

export default [
  {
    id: "response.protocol",
    title: "Every response declares PROTOCOL 2",
    level: "MUST",
    profile: "core",
    spec: "spec/versioning.md#the-protocol-number",
    async run(t) {
      const r = await t.start("ECHO");
      t.equal(r.json.S_FRONT.PROTOCOL, 2, "S_FRONT.PROTOCOL");
      const e = await t.event(r, "NOOP");
      t.equal(e.json.S_FRONT.PROTOCOL, 2, "S_FRONT.PROTOCOL of an event response");
    },
  },
  {
    id: "response.id-and-app",
    title: "S_FRONT carries a draft id and the answering app's class name in upper case",
    level: "MUST",
    profile: "core",
    spec: `${R}#s_front`,
    async run(t) {
      const r = await t.start("ECHO");
      t.ok(typeof r.json.S_FRONT.ID === "string" && r.json.S_FRONT.ID.length > 0, "S_FRONT.ID must be a non-empty string");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
    },
  },
  {
    id: "response.app-start-normalized",
    title: "The class in ?app_start= is matched case-insensitively",
    level: "MUST",
    profile: "core",
    spec: "spec/navigation.md#which-app-a-request-starts",
    async run(t) {
      const r = t.roundtrip(await t.client.start(t.apps.ECHO.toLowerCase()), "start in lower case");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
    },
  },
  {
    id: "response.start-displays-main",
    title: "The first start displays the MAIN view and sends the model",
    level: "MUST",
    profile: "core",
    spec: `${R}#view-slots`,
    async run(t) {
      const r = await t.start("ECHO");
      const d = displays(r);
      t.equal(d.length, 1, "number of displays");
      t.equal(d[0][2], "MAIN", "slot of the display");
      t.ok(typeof d[0][3] === "string" && d[0][3].length > 0, "the display carries the view");
      t.ok(hasModel(r), "a response that displays a view carries MODEL");
      t.deepEqual(r.json.MODEL, { COUNT: 0, LAST_ARGS: "", LAST_EVENT: "" }, "MODEL");
    },
  },
  {
    id: "response.model-absent-when-unchanged",
    title: "A roundtrip that changes nothing bound carries no MODEL and no action",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#model`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "NOOP");
      t.ok(!hasModel(r), `MODEL should be absent, is ${JSON.stringify(r.json.MODEL)}`);
      t.equal(systemActions(r).length + customActions(r).length, 0, "number of actions");
    },
  },
  {
    id: "response.model-push",
    title: "A roundtrip that changes bound data pushes the whole model without a view",
    level: "MUST",
    profile: "core",
    spec: `${R}#model`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "PUSH");
      t.equal(displays(r).length, 0, "number of displays");
      t.ok(hasModel(r), "MODEL must be present");
      t.deepEqual(r.json.MODEL, { COUNT: 100, LAST_ARGS: "", LAST_EVENT: "" }, "MODEL (the complete model, not a delta)");
    },
  },
  {
    id: "response.rerender",
    title: "Displaying MAIN again on an event sends the view and the model",
    level: "MUST",
    profile: "core",
    spec: `${R}#view-slots`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "RERENDER");
      t.ok(displayOf(r, "MAIN"), "a MAIN display");
      t.ok(hasModel(r), "MODEL must be present with a display");
    },
  },
  {
    id: "response.model-types",
    title: "MODEL carries numbers as JSON numbers, booleans as JSON booleans, structures as objects, tables as arrays",
    level: "MUST",
    profile: "core",
    spec: `${R}#model`,
    async run(t) {
      const m = (await t.start("BIND")).json.MODEL || {};
      t.equal(typeof m.QTY, "number", "type of QTY (TYPE i)");
      t.equal(typeof m.FLAG, "boolean", "type of FLAG (abap_bool)");
      t.equal(typeof m.NAME, "string", "type of NAME (string)");
      t.ok(m.S_ADDR && typeof m.S_ADDR === "object" && !Array.isArray(m.S_ADDR), "S_ADDR must be an object");
      t.ok(Array.isArray(m.T_ITEMS) && m.T_ITEMS.length === 3, "T_ITEMS must be an array of 3 rows");
      t.deepEqual(m.T_ITEMS[0], { DONE: false, ID: 1, TEXT: "one" }, "T_ITEMS[0]");
    },
  },
];
