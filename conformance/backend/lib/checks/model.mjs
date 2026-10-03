// spec/request.md#the-model-delta - what the backend makes of MODEL.
const D = "spec/request.md#the-model-delta";

const START_ROWS = "1:one:,2:two:,3:three:";

async function check(t, model) {
  const start = await t.start("BIND");
  const r = await t.event(start, "CHECK", { model });
  t.ok(r.json.MODEL && typeof r.json.MODEL.SUMMARY === "string", "MODEL.SUMMARY after CHECK");
  return r;
}

export default [
  {
    id: "model.scalar",
    title: "A scalar attribute in the delta replaces the bound value",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { NAME: "Ada" });
      t.equal(r.json.MODEL.SUMMARY, `Ada;1;;Berlin;10115;${START_ROWS}`, "SUMMARY");
    },
  },
  {
    id: "model.number-and-boolean",
    title: "Numbers and booleans in the delta reach typed attributes",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { QTY: 42, FLAG: true });
      t.equal(r.json.MODEL.SUMMARY, `start;42;X;Berlin;10115;${START_ROWS}`, "SUMMARY");
      t.equal(r.json.MODEL.FLAG, true, "MODEL.FLAG");
      t.equal(r.json.MODEL.QTY, 42, "MODEL.QTY");
    },
  },
  {
    id: "model.structure",
    title: "A structure travels as its whole value and replaces every component",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { S_ADDR: { CITY: "Paris", ZIP: "75001" } });
      t.equal(r.json.MODEL.SUMMARY, `start;1;;Paris;75001;${START_ROWS}`, "SUMMARY");
      t.deepEqual(r.json.MODEL.S_ADDR, { CITY: "Paris", ZIP: "75001" }, "MODEL.S_ADDR");
    },
  },
  {
    id: "model.table-row-delta",
    title: "A table edited by row (__delta) changes exactly the named cells",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { T_ITEMS: { __delta: { 1: { TEXT: "zwei", DONE: true } } } });
      t.equal(r.json.MODEL.SUMMARY, "start;1;;Berlin;10115;1:one:,2:zwei:X,3:three:", "SUMMARY");
      t.deepEqual(r.json.MODEL.T_ITEMS, [
        { DONE: false, ID: 1, TEXT: "one" },
        { DONE: true, ID: 2, TEXT: "zwei" },
        { DONE: false, ID: 3, TEXT: "three" },
      ], "MODEL.T_ITEMS (the complete table)");
    },
  },
  {
    id: "model.table-whole",
    title: "A table sent as its whole value replaces the table",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { T_ITEMS: [{ ID: 7, TEXT: "seven", DONE: true }] });
      t.equal(r.json.MODEL.SUMMARY, "start;1;;Berlin;10115;7:seven:X", "SUMMARY");
    },
  },
  {
    id: "model.combined-delta",
    title: "One delta can carry several attributes of different kinds",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, {
        NAME: "Ada", QTY: 7, FLAG: true, S_ADDR: { CITY: "Paris", ZIP: "75001" },
        T_ITEMS: { __delta: { 0: { TEXT: "eins" }, 2: { DONE: true } } },
      });
      t.equal(r.json.MODEL.SUMMARY, "Ada;7;X;Paris;75001;1:eins:,2:two:,3:three:X", "SUMMARY");
    },
  },
  {
    id: "model.absent-attributes-kept",
    title: "Attributes the delta does not name keep their server value",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const start = await t.start("BIND");
      const one = await t.event(start, "CHECK", { model: { NAME: "first" } });
      const two = await t.event(one, "CHECK", { model: { QTY: 5 } });
      t.equal(two.json.MODEL.SUMMARY, `first;5;;Berlin;10115;${START_ROWS}`, "SUMMARY after two partial deltas");
    },
  },
  {
    id: "model.unknown-attribute-ignored",
    title: "A delta for an attribute the app does not bind is ignored, not an error",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { NOT_BOUND_ANYWHERE: "x", NAME: "kept" });
      t.equal(r.json.MODEL.SUMMARY, `kept;1;;Berlin;10115;${START_ROWS}`, "SUMMARY");
    },
  },
  {
    id: "model.row-out-of-range-ignored",
    title: "A row delta for a row that does not exist is ignored",
    level: "SHOULD",
    profile: "core",
    spec: D,
    async run(t) {
      const r = await check(t, { T_ITEMS: { __delta: { 99: { TEXT: "nowhere" } } } });
      t.equal(r.json.MODEL.SUMMARY, `start;1;;Berlin;10115;${START_ROWS}`, "SUMMARY");
    },
  },
  {
    id: "model.table-grows",
    title: "Rows the app adds arrive with the next model push",
    level: "MUST",
    profile: "core",
    spec: "spec/response.md#model",
    async run(t) {
      const r = await t.event(await t.start("BIND"), "ADD_ROW");
      t.equal(r.json.MODEL && r.json.MODEL.T_ITEMS && r.json.MODEL.T_ITEMS.length, 4, "rows in MODEL.T_ITEMS");
      t.deepEqual(r.json.MODEL.T_ITEMS[3], { DONE: false, ID: 4, TEXT: "new" }, "MODEL.T_ITEMS[3]");
    },
  },
];
