// spec/windowed-tables.md - what a frontend does with a windowed table: the
// rows it was sent, the window state under /__WINDOW, an edit as positions,
// and (UI5 profile) the window requests of the list binding. The scripted
// answers are the node-runtime's, recorded from the conformance app WINDOW.
import { recorded, answer } from "../responses.mjs";
import { CHECK } from "./common.mjs";

const W = "spec/windowed-tables.md";
const U = "profiles/ui5.md#windowed-tables";
const APP = "Z2UI5_CL_CONF_WINDOW";
const EVENT = "___ZZZ_WIN";

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
    title: "A model with a windowed table is adopted: the rows of the window are on the screen, /__WINDOW fails nothing",
    level: "MUST",
    profile: "core",
    spec: `${W}#frontends`,
    async run(t) {
      await startWindow(t);
      const s = await t.state();
      t.ok(!s.error, `the frontend shows an error: ${s.error && s.error.text.slice(0, 300)}`);
      t.ok(s.slots.MAIN.open, "MAIN is not open");
      t.includes(s.slots.MAIN.text, "item 01", "MAIN (the first row of the window)");
      t.includes(s.slots.MAIN.text, "item 04", "MAIN (the last row of the window)");
      t.ok(!s.slots.MAIN.text.includes("item 05"), "MAIN shows a row the model does not carry");
    },
  },
  {
    id: "window.edit-as-delta",
    title: "A cell edited in a windowed table travels as a __delta at the position shown - never as the whole table, never with /__WINDOW",
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
      t.deepEqual(t.post(1).MODEL, { T_ROWS: { __delta: { 2: { DONE: true } } } }, "MODEL");
    },
  },
  {
    id: "ui5.window-growth",
    title: "A growing list over a windowed table asks for the next window: ___ZZZ_WIN [path, count], and shows the rows of the answer",
    level: "MUST",
    profile: "ui5",
    needs: ["dom"],
    spec: U,
    async run(t) {
      const first = await startWindow(t);
      t.includes((await t.state()).slots.MAIN.text, "4 / 12", "the growing trigger (TOTAL is the length of the list)");
      t.mock.reply(recorded("window.more-rows", 1));
      await t.press(MORE);
      await t.posted(2);
      t.equal(t.front(1).EVENT, EVENT, "S_FRONT.EVENT");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["/T_ROWS", "8"], "S_FRONT.T_EVENT_ARG");
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
    title: "sort( ) and filter( ) on the list binding of a windowed table go to the backend, each naming its own part; more rows name none",
    level: "MUST",
    profile: "ui5",
    needs: ["dom", "wires"],
    spec: U,
    async run(t) {
      await startWindow(t);
      t.mock.reply(recorded("window.sort", 1));
      await t.press({ text: "Sort list" });
      await t.posted(2);
      t.equal(t.front(1).EVENT, EVENT, "S_FRONT.EVENT of the sort");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["/T_ROWS", "4", JSON.stringify([{ PATH: "QTY", DESCENDING: true }])], "T_EVENT_ARG of the sort");
      await t.settle();
      t.includes((await t.state()).slots.MAIN.text, "item 05", "MAIN after the sort (the backend's order, not sorted again in the browser)");

      const grown = recorded("window.growth-keeps-order", 2);
      t.mock.reply(grown);
      await t.press(MORE);
      await t.posted(3);
      t.deepEqual(t.front(2).T_EVENT_ARG, ["/T_ROWS", "8"], "T_EVENT_ARG of the request for more rows after the sort");
      await t.settle();

      t.mock.reply(recorded("window.filter", 1));
      await t.press({ text: "Filter list" });
      await t.posted(4);
      t.deepEqual(t.front(3).T_EVENT_ARG, ["/T_ROWS", "4", "", JSON.stringify([[["NAME", "Contains", "1", null]]])], "T_EVENT_ARG of the filter");
      t.equal(t.front(3).ID, grown.body.S_FRONT.ID, "S_FRONT.ID of the filter");
      await t.settle();
      const s = await t.state();
      t.ok(!s.slots.MAIN.text.includes("item 05"), "MAIN after the filter still shows a row the answer does not carry");
      t.includes(s.slots.MAIN.text, "item 12", "MAIN after the filter");
    },
  },
];
