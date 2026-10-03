// spec/actions.md - follow-up actions and messages.
import { recorded, answer, display, mainView } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const A = "spec/actions.md";

export default [
  {
    id: "action.order",
    title: "Follow-up actions run in the order of T_CUSTOM",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ custom: [["MESSAGE_TOAST", "show", "first"], ["MESSAGE_TOAST", "show", "second"], ["MESSAGE_TOAST", "show", "third"]] }));
      await t.press(NEXT);
      const s = await t.state();
      const toasts = s.messages.filter((m) => m.kind === "toast").map((m) => m.text);
      t.deepEqual(toasts.filter((x) => ["first", "second", "third"].includes(x)), ["first", "second", "third"], "the toasts, in order");
    },
  },
  {
    id: "action.after-render",
    title: "Follow-up actions run after the views of the same response are built (SET_FOCUS finds its control)",
    level: "MUST",
    profile: "core",
    needs: ["focus"],
    spec: "spec/response.md#processing-order",
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ system: [display("MAIN", mainView('<Input id="fresh" value="{/V}"/>'))], model: { V: "" }, custom: [["SET_FOCUS", "fresh"]] }));
      await t.press(NEXT);
      await t.wait(200);
      const s = await t.state();
      t.equal(s.focus, "fresh", "the focused control");
    },
  },
  {
    id: "action.unknown-skipped",
    title: "An unknown follow-up action is skipped; the ones after it run, the screen stays",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      await startApp(t, `<Text text="still here"/>${nextButton}`);
      const r = answer({ custom: [["X_CONFORMANCE_UNKNOWN_ACTION", "arg", { opt: 1 }], ["MESSAGE_TOAST", "show", "after the unknown action"]] });
      t.mock.reply(r);
      await t.press(NEXT);
      const s = await t.state();
      t.ok(!s.error, `the unknown action failed the response: ${s.error && s.error.text}`);
      t.ok(s.messages.some((m) => m.text === "after the unknown action"), `the action after the unknown one did not run: ${JSON.stringify(s.messages)}`);
      t.ok(s.slots.MAIN.text.includes("still here"), "the screen is gone");
      t.mock.reply(answer({}));
      await t.press(NEXT);
      await t.posted(3);
      t.equal(t.front(2).ID, r.body.S_FRONT.ID, "S_FRONT.ID of the next event");
    },
  },
  {
    id: "action.unknown-reported",
    title: "An unknown follow-up action is reported (logged / listed as unsupported)",
    level: "SHOULD",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ custom: [["X_CONFORMANCE_UNKNOWN_ACTION", "arg"]] }));
      await t.press(NEXT);
      const s = await t.state();
      t.ok(s.log.some((l) => l.includes("X_CONFORMANCE_UNKNOWN_ACTION")), `nothing names the unknown action: ${JSON.stringify(s.log.slice(-5))}`);
    },
  },
  {
    id: "message.toast",
    title: "MESSAGE_TOAST show is shown with its text",
    level: "MUST",
    profile: "core",
    spec: `${A}#messages`,
    async run(t) {
      t.mock.reply(recorded("message.toast", 0));
      await t.start("Z2UI5_CL_CONF_MSG");
      t.mock.reply(recorded("message.toast", 1));
      await t.press({ text: "Toast", event: "TOAST" });
      const s = await t.state();
      t.ok(s.messages.some((m) => m.kind === "toast" && m.text === "conformance toast"), `no toast "conformance toast": ${JSON.stringify(s.messages)}`);
    },
  },
  {
    id: "message.box",
    title: "MESSAGE_BOX error is shown as a box with its text",
    level: "MUST",
    profile: "core",
    spec: `${A}#messages`,
    async run(t) {
      t.mock.reply(recorded("message.box", 0));
      await t.start("Z2UI5_CL_CONF_MSG");
      t.mock.reply(recorded("message.box", 1));
      await t.press({ text: "Box", event: "BOX" });
      const s = await t.state();
      const box = s.messages.find((m) => m.kind === "box" && m.text === "conformance box");
      t.ok(box, `no box "conformance box": ${JSON.stringify(s.messages)}`);
      t.ok(!box.type || box.type === "error", `the box type: ${box.type}`);
    },
  },
  {
    id: "message.box-close-event",
    title: "Closing a box with onClose raises that event with the pressed action as first argument",
    level: "MUST",
    profile: "core",
    needs: ["boxClose"],
    spec: `${A}#messages`,
    async run(t) {
      t.mock.reply(recorded("message.box-close-event", 0));
      await t.start("Z2UI5_CL_CONF_MSG");
      t.mock.reply(recorded("message.box-close-event", 1));
      await t.press({ text: "Confirm", event: "BOX_CONFIRM" });
      t.mock.reply(recorded("message.box-close-event", 2));
      await t.closeBox({ action: "CANCEL", text: "Cancel" });
      await t.posted(3);
      const f = t.front(2);
      t.equal(f.EVENT, "BOX_CLOSED", "S_FRONT.EVENT");
      t.equal((f.T_EVENT_ARG || [])[0], "CANCEL", "S_FRONT.T_EVENT_ARG[0]");
      t.equal(f.ID, recorded("message.box-close-event", 1).body.S_FRONT.ID, "S_FRONT.ID");
    },
  },
  {
    id: "message.details-sanitized",
    title: "The HTML details of a message box are sanitized before rendering",
    level: "MUST",
    profile: "core",
    needs: ["dom"],
    spec: `${A}#messages`,
    async run(t) {
      await startApp(t, nextButton);
      const details = '<p>detail text</p><img src="conformance-xss-probe" onerror="window.__confXss=1"><script>window.__confXss=1</script>';
      t.mock.reply(answer({ custom: [["MESSAGE_BOX", "error", "box with details", { details }]] }));
      await t.press(NEXT);
      await t.wait(300);
      const s = await t.state();
      t.ok(s.messages.some((m) => m.kind === "box"), "no box shown");
      t.ok(!s.xss, "a script in the details ran");
      const img = await t.adapter.evaluate(() => Boolean(document.querySelector('img[src="conformance-xss-probe"]')));
      t.ok(!img, "the <img onerror> of the details reached the DOM");
    },
  },
];
