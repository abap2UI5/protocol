// profiles/portable.md - what every portable renderer renders and tolerates.
import { recorded, answer, display, mainView } from "../responses.mjs";
import { startApp, NEXT, nextButton } from "./common.mjs";

const P = "profiles/portable.md";

export default [
  {
    id: "portable.default-aggregation",
    title: "A default aggregation is accepted with and without its element",
    level: "MUST",
    profile: "portable",
    spec: `${P}#2-documents-slots-and-namespaces`,
    async run(t) {
      await startApp(t, '<VBox><items><Text text="with the element"/></items></VBox><VBox><Text text="without the element"/></VBox>');
      const s = await t.state();
      t.includes(s.slots.MAIN.text, "with the element", "MAIN");
      t.includes(s.slots.MAIN.text, "without the element", "MAIN");
    },
  },
  {
    id: "portable.unknown-property",
    title: "An unknown property of a known control is ignored",
    level: "MUST",
    profile: "portable",
    spec: `${P}#conformance`,
    async run(t) {
      await startApp(t, '<Text text="text with a future property" conformanceFutureProperty="x"/>');
      const s = await t.state();
      t.ok(!s.error, `the view failed: ${s.error && s.error.text.slice(0, 300)}`);
      t.includes(s.slots.MAIN.text, "text with a future property", "MAIN");
    },
  },
  {
    id: "portable.unknown-control",
    title: "An element of an unknown control does not fail the view (a placeholder instead)",
    level: "MUST",
    profile: "portable",
    spec: `${P}#conformance`,
    async run(t) {
      if (t.adapter.profiles.includes("ui5")) {
        t.skip("a UI5-profile frontend has no outside: an element it cannot load is a failed view (profiles/portable.md#conformance)");
      }
      await startApp(t, '<Text text="before the unknown control"/><x:Gadget xmlns:x="com.example.conformance" size="3"/><Text text="after the unknown control"/>');
      const s = await t.state();
      t.ok(!s.error, `the view failed: ${s.error && s.error.text.slice(0, 300)}`);
      t.includes(s.slots.MAIN.text, "after the unknown control", "MAIN");
    },
  },
  {
    id: "portable.excluded-action",
    title: "A follow-up action outside the portable list does not fail the response",
    level: "MUST",
    profile: "portable",
    spec: `${P}#6-frontend-actions`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ custom: [["CONTROL_BY_ID", "no_such_control", "MAIN", "setBusy", true], ["MESSAGE_TOAST", "show", "after the excluded action"]] }));
      await t.press(NEXT);
      const s = await t.state();
      t.ok(!s.error, `the response failed: ${s.error && s.error.text}`);
      t.ok(s.messages.some((m) => m.text === "after the excluded action"), `the next action did not run: ${JSON.stringify(s.messages)}`);
    },
  },
  {
    id: "portable.box-details",
    title: "The details of a message box are shown",
    level: "MUST",
    profile: "portable",
    needs: ["dom"],
    spec: `${P}#6-frontend-actions`,
    async run(t) {
      await startApp(t, nextButton);
      t.mock.reply(answer({ custom: [["MESSAGE_BOX", "error", "a box with details", { details: "<p>conformance detail text</p><ul><li>first item</li></ul>" }]] }));
      await t.press(NEXT);
      await t.wait(300);
      const s = await t.state();
      t.ok(s.messages.some((m) => m.kind === "box"), "no box shown");
      t.includes(s.text, "conformance detail text", "the text on screen");
    },
  },
  {
    id: "portable.timer",
    title: "START_TIMER fires its event as an ordinary roundtrip after the delay",
    level: "MUST",
    profile: "portable",
    needs: ["timers"],
    spec: "spec/actions.md#vocabulary",
    async run(t) {
      t.mock.reply(recorded("action.timer", 0));
      await t.start("Z2UI5_CL_CONF_ACTIONS");
      const armed = recorded("action.timer", 1);
      t.mock.reply(armed);
      t.mock.reply(recorded("action.timer", 2));
      const at = Date.now();
      await t.press({ text: "Timer", event: "TIMER" });
      await t.posted(3, 5000);
      const f = t.front(2);
      t.equal(f.EVENT, "TICK", "S_FRONT.EVENT of the timer");
      t.equal(f.ID, armed.body.S_FRONT.ID, "S_FRONT.ID of the timer");
      t.ok(t.posts()[2].at - at >= 400, `the timer fired after ${t.posts()[2].at - at} ms, armed for 500`);
    },
  },
  {
    id: "portable.set-title",
    title: "SET_TITLE sets the document title",
    level: "MUST",
    profile: "portable",
    needs: ["title"],
    spec: `${P}#6-frontend-actions`,
    async run(t) {
      t.mock.reply(recorded("action.order", 0));
      await t.start("Z2UI5_CL_CONF_ACTIONS");
      t.mock.reply(recorded("action.order", 1));
      await t.press({ text: "Several", event: "SEVERAL" });
      const s = await t.state();
      t.equal(s.title, "conformance title", "document.title");
    },
  },
  {
    id: "portable.view-replaced",
    title: "A second MAIN display replaces the first",
    level: "MUST",
    profile: "portable",
    spec: "spec/response.md#view_slots-display",
    async run(t) {
      await startApp(t, `<Text text="the first view"/>${nextButton}`);
      t.mock.reply(answer({ system: [display("MAIN", mainView('<Text text="the second view"/>'))] }));
      await t.press(NEXT);
      const s = await t.state();
      t.includes(s.slots.MAIN.text, "the second view", "MAIN");
      t.ok(!s.slots.MAIN.text.includes("the first view"), `the first view is still there: ${s.slots.MAIN.text}`);
    },
  },
];
