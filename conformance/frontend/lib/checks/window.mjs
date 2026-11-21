// spec/windowed-tables.md - what a frontend does with a windowed table: the
// rows it was sent, the window state under /__WINDOW, an edit of a row it
// shows, and (UI5 profile) the window requests of the list binding - the
// app's event with reason, skip and top. The scripted answers are the
// node-runtime's, recorded from the conformance app WINDOW.
import { recorded, answer } from "../responses.mjs";
import { CHECK } from "./common.mjs";

const W = "spec/windowed-tables.md";
const U = "profiles/ui5.md#windowed-tables";
const APP = "Z2UI5_CL_CONF_WINDOW";
const EVENT = "___ZZZ_WIN";
const QTY_DESC = JSON.stringify([{ PATH: "QTY", DESCENDING: true }]);

/** Start the recorded WINDOW app: twelve rows, the first four in the model. */
async function startWindow(t) {
  const first = recorded("window.first-window", 0);
  t.mock.reply(first);
  await t.start(APP);
  return first.body;
}

/** The growing trigger of the sap.m.Table with the id "rows" ("More"). */
const MORE = { id: "rows-trigger" };

export default [
  {
    id: "window.rows-shown",
    title: "A model with a windowed table is adopted: the rows the app holds are on the screen, /__WINDOW fails nothing",
    level: "MUST",
    profile: "core",
    spec: `${W}#frontends`,
    async run(t) {
      await startWindow(t);
      const s = await t.state();
      t.ok(!s.error, `the frontend shows an error: ${s.error && s.error.text.slice(0, 300)}`);
      t.ok(s.slots.MAIN.open, "MAIN is not open");
      t.includes(s.slots.MAIN.text, "item 01", "MAIN (the first row of the table)");
      t.includes(s.slots.MAIN.text, "item 04", "MAIN (the last row of the table)");
      t.ok(!s.slots.MAIN.text.includes("item 05"), "MAIN shows a row the model does not carry");
    },
  },
  {
    id: "window.edit-row-shown",
    title: "A cell edited in a windowed table travels as an edit of the row shown - a __delta at its index or the table whole - never with /__WINDOW",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      const first = await startWindow(t);
      await t.fill({ path: "/T_ROWS/2/DONE" }, true);
      t.mock.reply(answer({ app: APP }));
      await t.press(CHECK);
      await t.posted(2);
      t.equal(t.front(1).ID, first.S_FRONT.ID, "S_FRONT.ID");
      const model = t.post(1).MODEL || {};
      t.deepEqual(Object.keys(model), ["T_ROWS"], "the attributes of MODEL");
      const rows = model.T_ROWS;
      if (Array.isArray(rows)) {
        const want = first.MODEL.T_ROWS.map((row, i) => (i === 2 ? { ...row, DONE: true } : row));
        t.deepEqual(rows, want, "MODEL.T_ROWS sent whole (the rows shown, the third one ticked)");
      } else {
        t.deepEqual(rows, { __delta: { 2: { DONE: true } } }, "MODEL.T_ROWS");
      }
    },
  },
  {
    id: "window.edit-row-shown-reference",
    title: "A cell edited in a windowed table behind a data reference travels on its * node - a __delta at the row's index or the whole value there - never with /__WINDOW",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      // MR_WIN of the app WINDOW: the model node /MR_WIN/*, its state at
      // /__WINDOW/MR_WIN/*
      const first = await startWindow(t);
      await t.fill({ path: "/MR_WIN/*/2/DONE" }, true);
      t.mock.reply(answer({ app: APP }));
      await t.press(CHECK);
      await t.posted(2);
      t.equal(t.front(1).ID, first.S_FRONT.ID, "S_FRONT.ID");
      const model = t.post(1).MODEL || {};
      t.deepEqual(Object.keys(model), ["MR_WIN"], "the attributes of MODEL");
      const node = model.MR_WIN && model.MR_WIN["*"];
      if (Array.isArray(node)) {
        const want = first.MODEL.MR_WIN["*"].map((row, i) => (i === 2 ? { ...row, DONE: true } : row));
        t.deepEqual(node, want, "MODEL.MR_WIN[\"*\"] sent whole (the rows shown, the third one ticked)");
      } else {
        t.deepEqual(model.MR_WIN, { "*": { __delta: { 2: { DONE: true } } } }, "MODEL.MR_WIN");
      }
    },
  },
  {
    id: "ui5.window-growth",
    title: "A growing list over a windowed table asks the app for the next window: ___ZZZ_WIN [path, event, MORE, skip, top], and shows the rows of the answer",
    level: "MUST",
    profile: "ui5",
    needs: ["dom"],
    spec: U,
    async run(t) {
      const first = await startWindow(t);
      t.includes((await t.state()).slots.MAIN.text, "4 / 12", "the growing trigger (TOTAL is the length of the list)");
      t.mock.reply(recorded("window.app-event", 1));
      await t.press(MORE);
      await t.posted(2);
      t.equal(t.front(1).EVENT, EVENT, "S_FRONT.EVENT");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["/T_ROWS", "ROWS", "MORE", "4", "4"], "S_FRONT.T_EVENT_ARG (skip the rows held, top one window)");
      t.equal(t.front(1).ID, first.S_FRONT.ID, "S_FRONT.ID");
      t.equal(t.post(1).MODEL, undefined, "MODEL (nothing was edited)");
      await t.settle();
      const s = await t.state();
      t.includes(s.slots.MAIN.text, "item 08", "MAIN after the answer");
      t.includes(s.slots.MAIN.text, "8 / 12", "the growing trigger after the answer");
    },
  },
  {
    id: "ui5.window-sort-filter",
    title: "sort( ) and filter( ) on the list binding of a windowed table ask the app for the first window of the new order, with the sorters and the filter groups both; more rows name neither",
    level: "MUST",
    profile: "ui5",
    needs: ["dom", "wires"],
    spec: U,
    async run(t) {
      await startWindow(t);
      t.mock.reply(recorded("window.request-sort-filter", 1));
      await t.press({ text: "Sort list" });
      await t.posted(2);
      t.equal(t.front(1).EVENT, EVENT, "S_FRONT.EVENT of the sort");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["/T_ROWS", "ROWS", "SORT", "0", "4", QTY_DESC, "[]"], "T_EVENT_ARG of the sort");
      await t.settle();
      t.includes((await t.state()).slots.MAIN.text, "item 05", "MAIN after the sort (the app's order, not sorted again in the browser)");

      const grown = recorded("window.request-sort-filter", 2);
      t.mock.reply(grown);
      await t.press(MORE);
      await t.posted(3);
      t.deepEqual(t.front(2).T_EVENT_ARG, ["/T_ROWS", "ROWS", "MORE", "4", "4"], "T_EVENT_ARG of the request for more rows after the sort");
      await t.settle();

      t.mock.reply(recorded("window.request-sort-filter", 3));
      await t.press({ text: "Filter list" });
      await t.posted(4);
      t.deepEqual(t.front(3).T_EVENT_ARG, ["/T_ROWS", "ROWS", "FILTER", "0", "4", QTY_DESC, JSON.stringify([[["NAME", "Contains", "1", null]]])], "T_EVENT_ARG of the filter (the sort sent along)");
      t.equal(t.front(3).ID, grown.body.S_FRONT.ID, "S_FRONT.ID of the filter");
      await t.settle();
      const s = await t.state();
      t.ok(!s.slots.MAIN.text.includes("item 05"), "MAIN after the filter still shows a row the answer does not carry");
      t.includes(s.slots.MAIN.text, "item 12", "MAIN after the filter");
    },
  },
  {
    id: "ui5.window-no-event",
    title: "A window state without EVENT names no app event: the list binding sends no window request for it",
    level: "MUST",
    profile: "ui5",
    needs: ["dom"],
    spec: `${W}#frontends`,
    async run(t) {
      const first = recorded("window.first-window", 0);
      delete first.body.MODEL.__WINDOW.T_ROWS.EVENT;
      t.mock.reply(first);
      await t.start(APP);
      t.includes((await t.state()).slots.MAIN.text, "4 / 12", "the growing trigger (TOTAL is the length of the list)");
      await t.press(MORE);
      await t.wait(300);
      await t.settle();
      t.equal(t.count(), 1, "roundtrip POSTs after the growing trigger was pressed");
    },
  },
];
