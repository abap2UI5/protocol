// spec/response.md#view-slots - POPUP, POPOVER, NEST, NEST2.
const S = "spec/response.md#view-slots";
import { displays, displayOf, destroys, hasModel, systemActions } from "../client.mjs";

const xmlOf = (a) => (a ? a[3] : "");

export default [
  {
    id: "slots.popup-display",
    title: "A popup is displayed into POPUP, the MAIN view stays",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "POPUP_OPEN");
      t.deepEqual(displays(r).map((a) => a[2]), ["POPUP"], "slots displayed");
      t.ok(/conformance popup/.test(xmlOf(displayOf(r, "POPUP"))), "the POPUP display carries the dialog");
      t.ok(hasModel(r), "a display carries MODEL");
    },
  },
  {
    id: "slots.popup-replace",
    title: "Displaying one slot twice in a roundtrip sends one display, the last",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "POPUP_REPLACE");
      const d = displays(r).filter((a) => a[2] === "POPUP");
      t.equal(d.length, 1, "POPUP displays");
      t.ok(/title="second"/.test(d[0][3]), "the last display wins");
    },
  },
  {
    id: "slots.popup-destroy",
    title: "Closing the popup is [\"VIEW_SLOTS\", \"destroy\", \"POPUP\"]",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const open = await t.event(await t.start("SLOTS"), "POPUP_OPEN");
      const r = await t.event(open, "POPUP_CLOSE");
      t.deepEqual(systemActions(r), [["VIEW_SLOTS", "destroy", "POPUP"]], "T_SYSTEM");
    },
  },
  {
    id: "slots.order",
    title: "View lifecycle actions leave in slot order (MAIN before POPUP), whatever order the app called",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "MAIN_AND_POPUP");
      t.deepEqual(displays(r).map((a) => a[2]), ["MAIN", "POPUP"], "display order");
    },
  },
  {
    id: "slots.popover",
    title: "A popover is displayed into POPOVER with its anchor (openById) and destroyed again",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const open = await t.event(await t.start("SLOTS"), "POPOVER_OPEN");
      const d = displayOf(open, "POPOVER");
      t.ok(d, "a POPOVER display");
      t.equal(d[4] && d[4].openById, "btn_popover", "options.openById");
      const close = await t.event(open, "POPOVER_CLOSE");
      t.ok(destroys(close, "POPOVER"), "POPOVER destroyed");
    },
  },
  {
    id: "slots.nest",
    title: "A nested view is displayed into NEST with anchor and mutators, and destroyed again",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const open = await t.event(await t.start("SLOTS"), "NEST_OPEN");
      const d = displayOf(open, "NEST");
      t.ok(d, "a NEST display");
      t.deepEqual(d[4], { id: "nest_anchor", methodInsert: "addItem", methodDestroy: "removeAllItems" }, "NEST options");
      t.equal(displayOf(open, "MAIN"), undefined, "a nested view does not re-display MAIN");
      const close = await t.event(open, "NEST_CLOSE");
      t.ok(destroys(close, "NEST"), "NEST destroyed");
    },
  },
  {
    id: "slots.nest2",
    title: "The second nested slot NEST2 works like NEST",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const open = await t.event(await t.start("SLOTS"), "NEST2_OPEN");
      const d = displayOf(open, "NEST2");
      t.ok(d, "a NEST2 display");
      t.deepEqual(d[4], { id: "nest2_anchor", methodInsert: "addItem", methodDestroy: "removeAllItems" }, "NEST2 options");
      const close = await t.event(open, "NEST2_CLOSE");
      t.ok(destroys(close, "NEST2"), "NEST2 destroyed");
    },
  },
];
