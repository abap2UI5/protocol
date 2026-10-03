// spec/errors.md - what a frontend does with a failed roundtrip.
import { recorded, errorReply } from "../responses.mjs";
import { CHECK, startBind } from "./common.mjs";

const E = "spec/errors.md#what-a-frontend-does-with-it";
const PROBE = 'abap2UI5 failed for <b>bold</b> <img src="conformance-xss-probe" onerror="window.__confXss=1"> conformance-error-marker';

export default [
  {
    id: "error.shown",
    title: "A 500 answer is shown to the user (the backend's real error body)",
    level: "MUST",
    profile: "core",
    spec: E,
    allowUnexpected: true,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("session.failed-roundtrip-not-persisted", 1));
      await t.press(CHECK);
      const s = await t.state();
      t.ok(s.error, "no error shown for a 500");
      t.includes(s.error.text, "unhandled exception in a POST request", "the error shown");
    },
  },
  {
    id: "error.as-text",
    title: "An error body is shown as text, verbatim - never interpreted as markup",
    level: "MUST",
    profile: "core",
    spec: E,
    allowUnexpected: true,
    async run(t) {
      await startBind(t);
      t.mock.reply(errorReply(500, PROBE));
      await t.press(CHECK);
      const s = await t.state();
      t.ok(s.error, "no error shown for a 500");
      t.includes(s.error.text, "<b>bold</b>", "the error shown (the markup of the body is text)");
      t.includes(s.error.text, "conformance-error-marker", "the error shown");
      t.ok(!s.xss, "a script in the error body ran");
      if (t.caps.has("dom")) {
        const img = await t.adapter.evaluate(() => Boolean(document.querySelector('img[src="conformance-xss-probe"]')));
        t.ok(!img, "the <img> of the error body reached the DOM");
      }
    },
  },
  {
    id: "error.empty-body",
    title: "An error without body is shown with its status (HTTP <status>)",
    level: "MUST",
    profile: "core",
    spec: E,
    allowUnexpected: true,
    async run(t) {
      await startBind(t);
      t.mock.reply({ status: 503, body: "" });
      await t.press(CHECK);
      const s = await t.state();
      t.ok(s.error, "no error shown for an empty 503");
      t.includes(s.error.text, "503", "the error shown");
    },
  },
  {
    id: "error.app-start",
    title: "A failed app start is shown as an error, not as an empty screen",
    level: "MUST",
    profile: "core",
    spec: E,
    allowUnexpected: true,
    async run(t) {
      t.mock.reply(recorded("error.unknown-app", 0));
      await t.start("Z2UI5_CL_CONF_DOES_NOT_EXIST");
      const s = await t.state();
      t.ok(s.error, "no error shown for a failed app start");
      t.includes(s.error.text, "does not exist", "the error shown");
    },
  },
];
