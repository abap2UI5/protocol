// spec/request.md#the-model-delta, spec/response.md#model - the model both ways.
import { recorded, answer, display, popupView, button, destroy } from "../responses.mjs";
import { CHECK, startBind, startApp, NEXT, nextButton, valueAt } from "./common.mjs";

const D = "spec/request.md#the-model-delta";
const M = "spec/response.md#model";

/** Start BIND, apply `edits` ([target, value]...), press Check; resolves the delta. */
async function editAndCheck(t, edits) {
  await startBind(t);
  for (const [target, value] of edits) await t.fill(target, value);
  t.mock.reply(recorded("model.scalar", 1));
  await t.press(CHECK);
  await t.posted(2);
  return t.post(1).MODEL;
}

export default [
  {
    id: "model.only-edited",
    title: "MODEL names exactly the attributes the user edited",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/NAME", id: "name" }, "Ada"]]);
      t.ok(m && typeof m === "object", "no MODEL sent for an edited field");
      t.deepEqual(Object.keys(m), ["NAME"], "the attributes in MODEL");
    },
  },
  {
    id: "model.none-when-unedited",
    title: "An event after no edit sends no model delta",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, []);
      t.ok(m === undefined || (m && !Object.keys(m).length), `MODEL: ${JSON.stringify(m)}`);
    },
  },
  {
    id: "model.scalar",
    title: "An edited scalar travels whole: \"NAME\": <current value>",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/NAME", id: "name" }, "Ada"]]);
      t.equal(m && m.NAME, "Ada", "MODEL.NAME");
    },
  },
  {
    id: "model.number-and-boolean",
    title: "A number and a boolean travel as JSON number and boolean",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/QTY", id: "qty" }, 42], [{ path: "/FLAG", id: "flag" }, true]]);
      t.equal(m && m.QTY, 42, "MODEL.QTY");
      t.equal(m && m.FLAG, true, "MODEL.FLAG");
    },
  },
  {
    id: "model.structure-whole",
    title: "An edited structure component sends the whole structure",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/S_ADDR/CITY", id: "city" }, "Paris"]]);
      t.deepEqual(m && m.S_ADDR, { CITY: "Paris", ZIP: "10115" }, "MODEL.S_ADDR");
    },
  },
  {
    id: "model.table-cell",
    title: "Edited table cells reach the backend: as __delta rows (0-based) or as the whole table",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/T_ITEMS/1/TEXT" }, "zwei"], [{ path: "/T_ITEMS/1/DONE" }, true], [{ path: "/T_ITEMS/2/TEXT" }, "drei"]]);
      const tab = m && m.T_ITEMS;
      t.ok(tab !== undefined, `MODEL has no T_ITEMS: ${JSON.stringify(m)}`);
      if (Array.isArray(tab)) {
        t.deepEqual(tab.map((r) => [r.TEXT, r.DONE]), [["one", false], ["zwei", true], ["drei", false]], "the whole T_ITEMS");
      } else {
        t.deepEqual(tab, { __delta: { 1: { TEXT: "zwei", DONE: true }, 2: { TEXT: "drei" } } }, "MODEL.T_ITEMS");
      }
    },
  },
  {
    id: "model.table-row-delta",
    title: "Edited table cells travel as a __delta of exactly the edited cells",
    level: "SHOULD",
    profile: "core",
    spec: D,
    async run(t) {
      const m = await editAndCheck(t, [[{ path: "/T_ITEMS/1/TEXT" }, "zwei"]]);
      t.deepEqual(m && m.T_ITEMS, { __delta: { 1: { TEXT: "zwei" } } }, "MODEL.T_ITEMS");
    },
  },
  {
    id: "model.nested-table",
    title: "A cell of a nested table travels as a nested __delta (or the whole value)",
    level: "SHOULD",
    profile: "core",
    spec: D,
    async run(t) {
      const view = `<Table items="{/T_TREE}"><columns><Column/><Column/></columns><items><ColumnListItem><cells><Text text="{NAME}"/>`
        + "<List items=\"{SUB}\"><items><CustomListItem><Input value=\"{V}\"/></CustomListItem></items></List>"
        + `</cells></ColumnListItem></items></Table>${nextButton}`;
      const model = { T_TREE: [{ NAME: "a", SUB: [{ V: "a0" }, { V: "a1" }] }, { NAME: "b", SUB: [{ V: "b0" }] }] };
      await startApp(t, view, { model });
      await t.fill({ path: "/T_TREE/0/SUB/1/V" }, "x");
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE" }));
      await t.press(NEXT);
      await t.posted(2);
      const tab = (t.post(1).MODEL || {}).T_TREE;
      if (Array.isArray(tab)) t.equal(tab[0] && tab[0].SUB && tab[0].SUB[1] && tab[0].SUB[1].V, "x", "T_TREE[0].SUB[1].V (whole table)");
      else t.deepEqual(tab, { __delta: { 0: { SUB: { __delta: { 1: { V: "x" } } } } } }, "MODEL.T_TREE");
    },
  },
  {
    id: "model.whole-beats-delta",
    title: "An attribute edited both whole and by cell travels whole",
    level: "MUST",
    profile: "core",
    needs: ["modelEdit"],
    spec: D,
    async run(t) {
      await startBind(t);
      await t.setModel("/T_ITEMS/0/TEXT", "cell edit");
      const whole = [{ ID: 1, TEXT: "whole", DONE: true }];
      await t.setModel("/T_ITEMS", whole);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      await t.posted(2);
      t.deepEqual((t.post(1).MODEL || {}).T_ITEMS, whole, "MODEL.T_ITEMS");
    },
  },
  {
    id: "model.slot-model",
    title: "An event from a popup sends the popup's edits only",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      t.mock.reply(recorded("slots.popup-destroy", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popup-destroy", 1));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      await t.fill({ path: "/POPUP_TEXT", id: "popup_text", slot: "POPUP" }, "typed in the popup");
      t.mock.reply(recorded("slots.popup-destroy", 2));
      await t.press({ text: "Close", event: "POPUP_CLOSE", slot: "POPUP" });
      t.mock.reply(recorded("slots.popover", 1));
      await t.press({ text: "Popover", event: "POPOVER_OPEN" });
      await t.posted(4);
      t.deepEqual(t.post(2).MODEL, { POPUP_TEXT: "typed in the popup" }, "MODEL of the popup's event");
      t.ok(!t.post(3).MODEL, `the next MAIN event re-sends the popup's edit: ${JSON.stringify(t.post(3).MODEL)}`);
    },
  },
  {
    id: "model.absent-keeps",
    title: "A response without MODEL keeps the model, edits included",
    level: "MUST",
    profile: "core",
    spec: M,
    async run(t) {
      await startBind(t);
      await t.fill({ path: "/NAME", id: "name" }, "Ada");
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_BIND" }));
      await t.press(CHECK);
      const s = await t.state();
      t.equal(valueAt(s, "/NAME"), "Ada", "the value of /NAME on screen");
      t.equal(valueAt(s, "/S_ADDR/CITY"), "Berlin", "the value of /S_ADDR/CITY on screen");
    },
  },
  {
    id: "model.push",
    title: "A response with MODEL and no view updates the bindings on screen",
    level: "MUST",
    profile: "core",
    spec: M,
    async run(t) {
      t.mock.reply(recorded("response.model-push", 0));
      await t.start("Z2UI5_CL_CONF_ECHO");
      const before = await t.state();
      t.mock.reply(recorded("response.model-push", 1));
      await t.press({ text: "Push", event: "PUSH" });
      const s = await t.state();
      t.ok(!before.slots.MAIN.text.includes("100") && s.slots.MAIN.text.includes("100"), `MAIN does not show the pushed COUNT 100: ${s.slots.MAIN.text}`);
      if (before.slots.MAIN.viewId) t.equal(s.slots.MAIN.viewId, before.slots.MAIN.viewId, "the MAIN view (a push without a display must not rebuild it)");
    },
  },
  {
    id: "model.push-own-app",
    title: "A pushed MODEL reaches only the slots of the app that answered",
    level: "MUST",
    profile: "core",
    spec: M,
    async run(t) {
      await startApp(t, `<Text text="{/NAME}"/>${nextButton}`, { app: "Z2UI5_CL_CONF_FE_A", model: { NAME: "alpha-main" } });
      // a popup app called by A: its own dialog over A's page
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE_B", system: [display("POPUP", popupView('<Text text="{/NAME}"/>', { buttons: button("Push", "PUSH") + button("Close", "CLOSE") }))], model: { NAME: "beta-popup" } }));
      await t.press(NEXT);
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE_B", model: { NAME: "beta-pushed" } }));
      await t.press({ text: "Push", event: "PUSH", slot: "POPUP" });
      const s = await t.state();
      t.ok(s.slots.POPUP.text.includes("beta-pushed"), `the popup does not show the push: ${s.slots.POPUP.text}`);
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE_B", system: [destroy("POPUP")] }));
      await t.press({ text: "Close", event: "CLOSE", slot: "POPUP" });
      const after = await t.state();
      t.ok(after.slots.MAIN.text.includes("alpha-main"), `A's page lost its model to B's push: ${after.slots.MAIN.text}`);
    },
  },
  {
    id: "model.pending-survive-push",
    title: "Edits made while a roundtrip is in flight survive its model push and travel next",
    level: "SHOULD",
    profile: "core",
    needs: ["concurrent"],
    spec: M,
    async run(t) {
      await startBind(t);
      const held = t.mock.replyHeld(recorded("model.scalar", 1));
      await t.press(CHECK, { wait: false });
      await held.received;
      await t.fill({ path: "/S_ADDR/ZIP", id: "zip" }, "75001");
      held.release();
      await t.settle();
      const s = await t.state();
      t.equal(valueAt(s, "/S_ADDR/ZIP"), "75001", "/S_ADDR/ZIP after the push");
      t.mock.reply(recorded("model.table-grows", 1));
      await t.press({ text: "Add row", event: "ADD_ROW" });
      await t.posted(3);
      t.equal(((t.post(2).MODEL || {}).S_ADDR || {}).ZIP, "75001", "MODEL.S_ADDR.ZIP of the next event");
    },
  },
  {
    id: "model.unchanged-push-no-delta",
    title: "Values the backend pushed are no edits: the next event sends no delta for them",
    level: "MUST",
    profile: "core",
    spec: D,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.mock.reply(recorded("model.table-grows", 1));
      await t.press({ text: "Add row", event: "ADD_ROW" });
      await t.posted(3);
      const m = t.post(2).MODEL;
      t.ok(!m || !Object.keys(m).length, `MODEL after a push and no edit: ${JSON.stringify(m)}`);
    },
  },
];
