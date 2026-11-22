// spec/response.md#view-slots - POPUP, POPOVER, NEST, NEST2.
const S = "spec/response.md#view-slots";
import { displays, displayOf, destroys, hasModel, views } from "../client.mjs";

const xmlOf = (v) => (v ? v.XML : "");
/** The standalone slots - what an app hop and an app start take down. */
const STANDALONE = ["POPUP", "POPOVER"];

export default [
  {
    id: "slots.popup-display",
    title: "A popup is displayed into POPUP, the MAIN view stays",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "POPUP_OPEN");
      t.deepEqual(displays(r), ["POPUP"], "slots displayed");
      t.ok(/conformance popup/.test(xmlOf(displayOf(r, "POPUP"))), "the POPUP display carries the dialog");
      t.ok(hasModel(r), "a display carries MODEL");
    },
  },
  {
    id: "slots.popup-replace",
    title: "Displaying one slot twice in a roundtrip sends the last display",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "POPUP_REPLACE");
      t.ok(/title="second"/.test(xmlOf(displayOf(r, "POPUP"))), "the last display wins");
    },
  },
  {
    id: "slots.popup-destroy",
    title: "Closing the popup is VIEWS.POPUP = { DESTROY: true }, and nothing else",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const open = await t.event(await t.start("SLOTS"), "POPUP_OPEN");
      const r = await t.event(open, "POPUP_CLOSE");
      t.deepEqual(views(r), { POPUP: { DESTROY: true } }, "S_FRONT.VIEWS");
    },
  },
  {
    id: "slots.several",
    title: "Views displayed in one roundtrip travel each under its slot, whatever order the app called",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      const r = await t.event(await t.start("SLOTS"), "MAIN_AND_POPUP");
      t.deepEqual(displays(r), ["MAIN", "POPUP"], "slots displayed");
      t.ok(/title="with main"/.test(xmlOf(displayOf(r, "POPUP"))), "the POPUP display carries the dialog");
      t.ok(xmlOf(displayOf(r, "MAIN")).length > 0, "the MAIN display carries the view");
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
      t.equal(d.OPT && d.OPT.openById, "btn_popover", "OPT.openById");
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
      t.deepEqual(d.OPT, { id: "nest_anchor", methodInsert: "addItem", methodDestroy: "removeAllItems" }, "NEST OPT");
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
      t.deepEqual(d.OPT, { id: "nest2_anchor", methodInsert: "addItem", methodDestroy: "removeAllItems" }, "NEST2 OPT");
      const close = await t.event(open, "NEST2_CLOSE");
      t.ok(destroys(close, "NEST2"), "NEST2 destroyed");
    },
  },
  {
    id: "slots.start-teardown",
    title: "An app start says what becomes of POPUP and POPOVER: each is torn down unless the app displays it",
    level: "MUST",
    profile: "core",
    spec: `${S}`,
    async run(t) {
      const r = await t.start("SLOTS");
      for (const slot of STANDALONE) t.ok(destroys(r, slot), `VIEWS.${slot}.DESTROY of an app start`);
    },
  },
  {
    id: "slots.hop-teardown",
    title: "A response of another app than the request continued tears POPUP and POPOVER down unless that app displays them - a call and a return alike",
    level: "MUST",
    profile: "core",
    spec: `${S}`,
    async run(t) {
      const called = await t.event(await t.start("NAV"), "CALL");
      for (const slot of STANDALONE) t.ok(destroys(called, slot), `VIEWS.${slot}.DESTROY of the called app's response`);
      const back = await t.event(called, "DONE");
      for (const slot of STANDALONE) t.ok(destroys(back, slot), `VIEWS.${slot}.DESTROY of the return`);
      const stays = await t.event(back, "NOOP");
      for (const slot of STANDALONE) t.ok(!destroys(stays, slot), `a roundtrip that stays in the app tears ${slot} down unasked`);
    },
  },
];
