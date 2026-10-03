// spec/response.md, spec/versioning.md - reading a response: PROTOCOL,
// unknown keys, absent queues, the view slots.
import { recorded, answer, display, router, mainView, popupView, popoverView, button } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const V = "spec/versioning.md#the-protocol-number";
const S = "spec/response.md#view-slots";

const MARKER = "conformance-marker-view";

export default [
  {
    id: "response.protocol-mismatch",
    title: "A response with another PROTOCOL is an error; its view is not shown",
    level: "MUST",
    profile: "core",
    spec: V,
    async run(t) {
      t.mock.reply(answer({ protocol: 3, system: [display("MAIN", mainView(`<Text text="${MARKER}"/>${nextButton}`))] }));
      await t.start("Z2UI5_CL_CONF_FE");
      const s = await t.state();
      t.ok(s.error, "no error shown for PROTOCOL 3");
      t.ok(!s.slots.MAIN.text.includes(MARKER), "the PROTOCOL 3 view was rendered");
    },
  },
  {
    id: "response.protocol-mismatch-message",
    title: "The protocol error names both protocol numbers",
    level: "SHOULD",
    profile: "core",
    spec: V,
    async run(t) {
      t.mock.reply(answer({ protocol: 3, system: [display("MAIN", mainView(`<Text text="${MARKER}"/>`))] }));
      await t.start("Z2UI5_CL_CONF_FE");
      const s = await t.state();
      t.ok(s.error, "no error shown for PROTOCOL 3");
      t.ok(/\b2\b/.test(s.error.text) && /\b3\b/.test(s.error.text), `the error does not say which numbers met: ${s.error.text.slice(0, 300)}`);
    },
  },
  {
    id: "response.protocol-absent",
    title: "A response without PROTOCOL is let through",
    level: "SHOULD",
    profile: "core",
    spec: V,
    async run(t) {
      t.mock.reply(answer({ protocol: undefined, system: [display("MAIN", mainView(`<Text text="${MARKER}"/>`))] }));
      await t.start("Z2UI5_CL_CONF_FE");
      const s = await t.state();
      t.ok(!s.error, `an error was shown: ${s.error && s.error.text}`);
      t.ok(s.slots.MAIN.text.includes(MARKER), `the view was not rendered: ${s.slots.MAIN.text}`);
    },
  },
  {
    id: "response.unknown-keys",
    title: "Unknown keys (S_FRONT, root, slot and ROUTER options) are ignored",
    level: "MUST",
    profile: "core",
    spec: "spec/versioning.md#compatible-changes-within-protocol-2",
    async run(t) {
      const r = answer({
        system: [display("MAIN", mainView(`<Text text="${MARKER}"/>${nextButton}`), { futureSlotOption: { a: 1 } }), router({ futureRouterOption: true })],
        sFront: { FUTURE_KEY: { x: [1, 2] } },
        extra: { FUTURE_ROOT_KEY: "x" },
        model: { NAME: "n" },
      });
      t.mock.reply(r);
      await t.start("Z2UI5_CL_CONF_FE");
      let s = await t.state();
      t.ok(!s.error, `an error was shown: ${s.error && s.error.text}`);
      t.ok(s.slots.MAIN.text.includes(MARKER), `the view was not rendered: ${s.slots.MAIN.text}`);
      t.mock.reply(answer({}));
      await t.press(NEXT);
      await t.posted(2);
      t.equal(t.front(1).ID, r.body.S_FRONT.ID, "S_FRONT.ID of the next event");
      s = await t.state();
      t.ok(!s.error, `an error was shown: ${s.error && s.error.text}`);
    },
  },
  {
    id: "response.no-actions",
    title: "A response without S_ACTION and MODEL changes nothing on screen",
    level: "MUST",
    profile: "core",
    spec: "spec/response.md#s_front",
    async run(t) {
      await startApp(t, `<Text text="${MARKER}"/>${nextButton}`);
      const bare = answer({});
      t.mock.reply(bare);
      await t.press(NEXT);
      t.mock.reply(answer({}));
      await t.press(NEXT);
      await t.posted(3);
      const s = await t.state();
      t.ok(!s.error, `an error was shown: ${s.error && s.error.text}`);
      t.ok(s.slots.MAIN.text.includes(MARKER), `the screen changed: ${s.slots.MAIN.text}`);
      t.equal(t.front(2).ID, bare.body.S_FRONT.ID, "S_FRONT.ID after the bare response");
    },
  },
  {
    id: "response.not-json",
    title: "A 2xx answer that is not JSON is an error",
    level: "MUST",
    profile: "core",
    spec: "spec/errors.md#what-a-frontend-does-with-it",
    async run(t) {
      t.mock.reply({ status: 200, headers: { "content-type": "text/html" }, body: "<html><body>a login page</body></html>" });
      await t.start("Z2UI5_CL_CONF_FE");
      const s = await t.state();
      t.ok(s.error, "no error shown for a 200 that is not JSON");
    },
  },
  {
    id: "response.no-s-front",
    title: "A 2xx JSON answer without S_FRONT is an error",
    level: "MUST",
    profile: "core",
    spec: "spec/errors.md#what-a-frontend-does-with-it",
    async run(t) {
      t.mock.reply({ status: 200, body: { d: { results: [] } } });
      await t.start("Z2UI5_CL_CONF_FE");
      const s = await t.state();
      t.ok(s.error, "no error shown for a JSON answer without S_FRONT");
    },
  },
  {
    id: "slots.main",
    title: "A MAIN display is rendered as the screen",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("response.start-displays-main", 0));
      await t.start("Z2UI5_CL_CONF_ECHO");
      const s = await t.state();
      t.ok(s.slots.MAIN.open, "MAIN is not open");
      t.ok(/conformance - echo|Echo/.test(s.slots.MAIN.text), `MAIN does not show the echo view: ${s.slots.MAIN.text}`);
      t.equal(s.app, "Z2UI5_CL_CONF_ECHO", "the app the frontend adopted");
    },
  },
  {
    id: "slots.popup",
    title: "A POPUP display opens over MAIN; a POPUP destroy closes it",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("slots.popup-destroy", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popup-destroy", 1));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      let s = await t.state();
      t.ok(s.slots.POPUP.open, "the popup is not open");
      t.ok(s.slots.MAIN.open, "MAIN went away under the popup");
      t.mock.reply(recorded("slots.popup-destroy", 2));
      await t.press({ text: "Close", event: "POPUP_CLOSE", slot: "POPUP" });
      s = await t.state();
      t.ok(!s.slots.POPUP.open, "the popup is still open after VIEW_SLOTS destroy POPUP");
      t.ok(s.slots.MAIN.open, "MAIN is gone");
    },
  },
  {
    id: "slots.popover",
    title: "A POPOVER display opens by its anchor; a POPOVER destroy closes it",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("slots.popover", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popover", 1));
      await t.press({ text: "Popover", event: "POPOVER_OPEN" });
      let s = await t.state();
      t.ok(s.slots.POPOVER.open, "the popover is not open");
      t.mock.reply(recorded("slots.popover", 2));
      await t.press({ text: "Close", event: "POPOVER_CLOSE", slot: "POPOVER" });
      s = await t.state();
      t.ok(!s.slots.POPOVER.open, "the popover is still open after VIEW_SLOTS destroy POPOVER");
    },
  },
  {
    id: "slots.main-tears-down",
    title: "A MAIN display takes the popup down; a popup displayed with it opens after it",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("slots.popup-destroy", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popup-destroy", 1));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      const main = recorded("slots.popup-destroy", 0);
      main.body.S_FRONT.ID = answer({}).body.S_FRONT.ID;
      t.mock.reply(main);
      await t.press({ text: "Close", event: "POPUP_CLOSE", slot: "POPUP" });
      let s = await t.state();
      t.ok(!s.slots.POPUP.open, "the popup survived a MAIN display");
      t.mock.reply(recorded("slots.order", 1));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      s = await t.state();
      t.ok(s.slots.MAIN.open && s.slots.POPUP.open, `MAIN and POPUP of one response: MAIN ${s.slots.MAIN.open}, POPUP ${s.slots.POPUP.open}`);
    },
  },
  {
    id: "slots.app-change",
    title: "A response of another APP takes POPUP and POPOVER down",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("slots.popover", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popover", 1));
      await t.press({ text: "Popover", event: "POPOVER_OPEN" });
      let s = await t.state();
      t.ok(s.slots.POPOVER.open, "the popover is not open");
      // a popup app takes over: its own dialog, no MAIN display, no destroy
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE_POPUP_APP", system: [display("POPUP", popupView('<Text text="the popup app"/>', { buttons: button("OK", "OK") }))], model: { X: 1 } }));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      s = await t.state();
      t.ok(!s.slots.POPOVER.open, "the popover of the previous app is still open");
      t.ok(s.slots.POPUP.open, "the new app's popup did not open");
    },
  },
  {
    id: "slots.nest-processed",
    title: "A NEST / NEST2 display is processed without failing the roundtrip",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      t.mock.reply(recorded("slots.nest", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.nest", 1));
      await t.press({ text: "Nest", event: "NEST_OPEN" });
      let s = await t.state();
      t.ok(!s.error, `the NEST display failed: ${s.error && s.error.text}`);
      const nest = recorded("slots.nest2", 1);
      t.mock.reply(nest);
      await t.press({ text: "Nest2", event: "NEST2_OPEN" });
      s = await t.state();
      t.ok(!s.error, `the NEST2 display failed: ${s.error && s.error.text}`);
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_SLOTS" }));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      await t.posted(4);
      t.equal(t.front(3).ID, nest.body.S_FRONT.ID, "S_FRONT.ID after the NEST2 display");
    },
  },
  {
    id: "slots.frontend-close",
    title: "The wired popup close (.eF VIEW_SLOTS destroy POPUP) closes it without a roundtrip",
    level: "MUST",
    profile: "core",
    spec: "spec/actions.md#wired-frontend-actions",
    async run(t) {
      t.mock.reply(recorded("slots.popup-destroy", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.popup-destroy", 1));
      await t.press({ text: "Popup", event: "POPUP_OPEN" });
      await t.press({ text: "Close here", event: "@CLOSE_POPUP", slot: "POPUP" });
      await t.wait(300);
      const s = await t.state();
      t.ok(!s.slots.POPUP.open, "the popup is still open");
      t.equal(t.posts().length, 2, "POSTs (the close must not roundtrip)");
    },
  },
  {
    id: "slots.popover-over-main",
    title: "A popover leaves MAIN on screen",
    level: "MUST",
    profile: "core",
    spec: S,
    async run(t) {
      await startApp(t, `<Button id="anchor" text="Anchor" press=".eB(['OPEN'])"/><Text text="${MARKER}"/>`);
      t.mock.reply(answer({ system: [display("POPOVER", popoverView('<Text text="in the popover"/>'), { openById: "anchor" })] }));
      await t.press({ text: "Anchor", event: "OPEN" });
      const s = await t.state();
      t.ok(s.slots.POPOVER.open, "the popover is not open");
      t.ok(s.slots.MAIN.open && s.slots.MAIN.text.includes(MARKER), "MAIN is not on screen beside the popover");
    },
  },
];

