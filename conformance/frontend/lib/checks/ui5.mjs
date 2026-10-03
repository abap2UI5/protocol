// profiles/ui5.md - the UI5 profile: wire forms, nested views.
import { recorded, answer, attr } from "../responses.mjs";
import { startApp } from "./common.mjs";

const U = "profiles/ui5.md";

export default [
  {
    id: "ui5.wire-ebp",
    title: "A .eBP($event, true, ['EVENT'], arg) wire roundtrips like .eB",
    level: "MUST",
    profile: "ui5",
    needs: ["wires"],
    spec: `${U}#event-wires`,
    async run(t) {
      await startApp(t, `<Button text="Prevent" press="${attr(".eBP($event, true, ['EBP'], 'a1')")}"/>`);
      t.mock.reply(answer({}));
      await t.press({ text: "Prevent", event: "EBP" });
      await t.posted(2);
      t.equal(t.front(1).EVENT, "EBP", "S_FRONT.EVENT");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["a1"], "S_FRONT.T_EVENT_ARG");
    },
  },
  {
    id: "ui5.wire-source-argument",
    title: "A ${$source>/prop} argument is resolved from the firing control",
    level: "MUST",
    profile: "ui5",
    needs: ["wires"],
    spec: `${U}#event-wires`,
    async run(t) {
      await startApp(t, `<Button text="Source text" press="${attr(".eB(['SRC'], ${$source>/text})")}"/>`);
      t.mock.reply(answer({}));
      await t.press({ text: "Source text", event: "SRC" });
      await t.posted(2);
      t.deepEqual(t.front(1).T_EVENT_ARG, ["Source text"], "S_FRONT.T_EVENT_ARG");
    },
  },
  {
    id: "ui5.wire-queue-last",
    title: "A queue-last wire keeps its last firing during a roundtrip and sends it afterwards",
    level: "MUST",
    profile: "ui5",
    needs: ["wires", "concurrent"],
    spec: `${U}#event-wires`,
    async run(t) {
      const wire = ".eB(['LIVE', false, false, false, true, true], ${$parameters>/value})";
      await startApp(t, `<Input id="live" value="{/Q}" liveChange="${attr(wire)}"/>`, { model: { Q: "" } });
      const held = t.mock.replyHeld(answer({}));
      t.mock.reply(answer({}));
      await t.adapter.type({ id: "live" }, "a");
      await held.received;
      await t.adapter.type({ id: "live" }, "bc");
      await t.wait(200);
      t.equal(t.posts().length, 2, "POSTs while the first keystroke's roundtrip is in flight");
      held.release();
      await t.posted(3);
      await t.settle();
      await t.wait(300);
      t.equal(t.posts().length, 3, "POSTs after the roundtrip (one queued firing, the last)");
      t.deepEqual(t.front(1).T_EVENT_ARG, ["a"], "T_EVENT_ARG of the first firing");
      t.deepEqual(t.front(2).T_EVENT_ARG, ["abc"], "T_EVENT_ARG of the queued firing");
      t.equal(t.front(2).ID, JSON.parse(t.mock.posts()[1].reply.text).S_FRONT.ID, "S_FRONT.ID of the queued firing");
    },
  },
  {
    id: "ui5.nest",
    title: "A NEST view is inserted into its anchor inside MAIN and destroyed again",
    level: "MUST",
    profile: "ui5",
    needs: ["nest"],
    spec: "spec/response.md#view-slots",
    async run(t) {
      t.mock.reply(recorded("slots.nest", 0));
      await t.start("Z2UI5_CL_CONF_SLOTS");
      t.mock.reply(recorded("slots.nest", 1));
      await t.press({ text: "Nest", event: "NEST_OPEN" });
      let s = await t.state();
      t.ok(s.slots.NEST.open, "NEST is not rendered");
      t.ok(s.slots.NEST.text && s.slots.MAIN.text.includes(s.slots.NEST.text), `NEST is not inside MAIN: NEST "${s.slots.NEST.text}"`);
      t.mock.reply(recorded("slots.nest", 2));
      await t.press({ text: "Close", event: "NEST_CLOSE", slot: "NEST" });
      s = await t.state();
      t.ok(!s.slots.NEST.open, "NEST is still there after VIEW_SLOTS destroy NEST");
    },
  },
];
