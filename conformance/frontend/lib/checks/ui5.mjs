// profiles/ui5.md - the UI5 profile: wire forms, nested views.
import { recorded, answer, attr, display, destroy, popupView, button, errorReply } from "../responses.mjs";
import { startApp, app, nextButton } from "./common.mjs";

const U = "profiles/ui5.md";
const TIMER = "spec/actions.md#the-timer";
const ACTIONS_APP = "Z2UI5_CL_CONF_ACTIONS";
const REPEAT = { text: "Repeat", event: "TIMER_REPEAT" };
/** A response of the app ACTIONS that changes nothing on screen - what a
 *  tick of a poll that found nothing new answers. */
const quiet = (extra = {}) => answer({ app: ACTIONS_APP, ...extra });

/** Start the recorded app ACTIONS; script the response that arms the
 *  repeating timer (["START_TIMER", "TICK", "500", "", "X"]) and resolve it -
 *  the caller scripts what follows and presses REPEAT. */
async function startActions(t) {
  t.mock.reply(recorded("action.timer-repeat", 0));
  await t.start(ACTIONS_APP);
  const armed = recorded("action.timer-repeat", 1);
  t.mock.reply(armed);
  return armed;
}

/** No POST arrives within `ms` beyond the `n` there are. */
async function noMorePosts(t, n, ms, what) {
  await t.settle();
  await t.wait(ms);
  t.equal(t.posts().length, n, what);
}

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
    title: "A wire with the options { queueLast, noBusy } keeps its last firing during a roundtrip and sends it afterwards",
    level: "MUST",
    profile: "ui5",
    needs: ["wires", "concurrent"],
    spec: `${U}#event-wires`,
    async run(t) {
      const wire = ".eB(['LIVE',{queueLast:true,noBusy:true}], ${$parameters>/value})";
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
  {
    id: "ui5.timer-repeat",
    title: "A repeating START_TIMER ticks again after every response, with the id that response named, until a STOP_TIMER",
    level: "MUST",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      const armed = await startActions(t);
      const tick1 = quiet();
      const tick2 = quiet();
      t.mock.reply(tick1);
      t.mock.reply(tick2);
      // the third tick is answered with ["STOP_TIMER"] (the app's TIMER_STOP, recorded)
      t.mock.reply(recorded("action.timer-repeat", 2));
      await t.press(REPEAT);
      await t.posted(5, 6000);
      const want = [armed, tick1, tick2].map((r) => r.body.S_FRONT.ID);
      for (let i = 0; i < 3; i += 1) {
        const f = t.front(2 + i);
        t.equal(f.EVENT, "TICK", `S_FRONT.EVENT of tick ${i + 1}`);
        t.equal(f.ID, want[i], `S_FRONT.ID of tick ${i + 1} (the id the response before it named)`);
        t.ok(!("TIMER" in f) || f.TIMER === true, `tick ${i + 1} carries S_FRONT.TIMER ${JSON.stringify(f.TIMER)}`);
      }
      const p = t.posts();
      t.ok(p[3].at - p[2].answeredAt >= 400, `tick 2 left ${p[3].at - p[2].answeredAt} ms after the response to tick 1 - armed again for 500`);
      await noMorePosts(t, 5, 1500, "POSTs after the response with STOP_TIMER (the timer must end)");
    },
  },
  {
    id: "ui5.timer-repeat-user-event",
    title: "A repeating START_TIMER does not tick while a user event is in flight, and goes on after its response",
    level: "MUST",
    profile: "ui5",
    needs: ["timers", "concurrent"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      const user = quiet();
      const held = t.mock.replyHeld(user);
      t.mock.reply(recorded("action.timer-repeat", 2));
      await t.press(REPEAT);
      // at once, before the first tick (500 ms)
      await t.press({ text: "Focus", event: "FOCUS" }, { wait: false });
      await held.received;
      await t.wait(1200);
      const during = t.posts().length;
      held.release();
      try {
        await t.posted(4, 4000);
      } catch {
        // judged below
      }
      t.equal(during, 3, "POSTs while the user event was in flight (app start, TIMER_REPEAT, FOCUS) - no tick");
      t.equal(t.front(2).EVENT, "FOCUS", "S_FRONT.EVENT of the user event");
      t.ok(t.posts().length >= 4, "no tick after the user event's response - a user event must not end a repeating timer");
      t.equal(t.front(3).EVENT, "TICK", "S_FRONT.EVENT after the user event");
      t.equal(t.front(3).ID, user.body.S_FRONT.ID, "S_FRONT.ID of the tick (the id the user event's response named)");
      await noMorePosts(t, 4, 1500, "POSTs after the response with STOP_TIMER");
    },
  },
  {
    id: "ui5.timer-stop",
    title: "STOP_TIMER wired into a view (.eF) ends a repeating timer without a roundtrip, and does nothing when no timer runs",
    level: "MUST",
    profile: "ui5",
    needs: ["timers", "wires"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      const stopHere = { text: "Stop here", event: "@STOP_TIMER" };
      await t.press(stopHere);
      await t.wait(200);
      t.equal(t.posts().length, 1, "POSTs after the wired STOP_TIMER with no timer running");
      let s = await t.state();
      t.ok(!s.error, `the frontend shows an error: ${s.error && s.error.text}`);
      await t.press(REPEAT);
      await t.press(stopHere);
      await noMorePosts(t, 2, 1500, "POSTs after the wired STOP_TIMER (no tick, no roundtrip)");
      s = await t.state();
      t.ok(!s.error, `the frontend shows an error: ${s.error && s.error.text}`);
    },
  },
  {
    id: "ui5.timer-replace",
    title: "A START_TIMER without the repeat flag replaces a repeating timer - it ticks once",
    level: "MUST",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      // the first tick is answered with a one-shot ["START_TIMER", "TICK", "500"] (recorded)
      t.mock.reply(recorded("action.timer", 1));
      t.mock.reply(quiet());
      await t.press(REPEAT);
      await t.posted(4, 5000);
      t.equal(t.front(3).EVENT, "TICK", "S_FRONT.EVENT of the one-shot tick");
      await noMorePosts(t, 4, 1500, "POSTs after the one-shot tick's response (the repeat was replaced)");
    },
  },
  {
    id: "ui5.timer-repeat-app-change",
    title: "A response that names another APP ends a repeating timer",
    level: "MUST",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      // the first tick is answered by another app (a navigation)
      t.mock.reply(app(nextButton));
      await t.press(REPEAT);
      await t.posted(3, 5000);
      await noMorePosts(t, 3, 1500, "POSTs after the response of another app (the timer must end)");
      const s = await t.state();
      t.equal(s.app, "Z2UI5_CL_CONF_FE", "the app on screen");
    },
  },
  {
    id: "ui5.timer-repeat-popup",
    title: "A repeating timer armed from a popup goes on under it and after it closed",
    level: "SHOULD",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      t.mock.reply(recorded("action.timer-repeat", 0));
      await t.start(ACTIONS_APP);
      t.mock.reply(quiet({ views: { POPUP: display(popupView(button("Arm", "ARM"))) } }));
      t.mock.reply(quiet({ actions: [["START_TIMER", "TICK", "500", "", "X"]] }));
      // the first tick closes the popup, the second is answered with the stop
      t.mock.reply(quiet({ views: { POPUP: destroy() } }));
      t.mock.reply(recorded("action.timer-repeat", 2));
      // the popup opens on an event of the app (any of its buttons)
      await t.press({ text: "Focus", event: "FOCUS" });
      let s = await t.state();
      t.ok(s.slots.POPUP.open, "the popup is not open");
      await t.press({ text: "Arm", event: "ARM", slot: "POPUP" });
      try {
        await t.posted(5, 5000);
      } catch {
        // judged below
      }
      t.ok(t.posts().length >= 4, "no tick under the popup");
      t.ok(t.posts().length >= 5, "no tick after the popup closed - the timer must go on with MAIN");
      t.deepEqual([t.front(3).EVENT, t.front(4).EVENT], ["TICK", "TICK"], "S_FRONT.EVENT of the two ticks");
      s = await t.state();
      t.ok(!s.slots.POPUP.open, "the popup is still open");
      await noMorePosts(t, 5, 1500, "POSTs after the response with STOP_TIMER");
    },
  },
  {
    id: "ui5.timer-repeat-error",
    title: "An error response ends a repeating timer",
    level: "SHOULD",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      t.mock.reply(errorReply(500, "conformance: the tick failed"));
      await t.press(REPEAT);
      await t.posted(3, 5000);
      await noMorePosts(t, 3, 1500, "POSTs after the error (the timer must end - it would tick under the error)");
    },
  },
  {
    id: "ui5.timer-repeat-retry",
    title: "The error's Retry takes a repeating timer up again",
    level: "SHOULD",
    profile: "ui5",
    needs: ["timers"],
    spec: TIMER,
    async run(t) {
      await startActions(t);
      // the first tick meets a 503 - a request that may not have reached the
      // backend, which the frontend offers to re-send (spec/transport.md)
      t.mock.reply(errorReply(503, "conformance: the backend is restarting"));
      t.mock.reply(quiet());
      // the next tick is answered with ["STOP_TIMER"] (recorded)
      t.mock.reply(recorded("action.timer-repeat", 2));
      await t.press(REPEAT);
      await t.posted(3, 5000);
      await t.settle();
      await noMorePosts(t, 3, 1000, "POSTs under the error (the timer must end with it)");
      await t.retry();
      try {
        await t.posted(5, 5000);
      } catch {
        // judged below
      }
      t.ok(t.posts().length >= 4, "the Retry sent nothing");
      t.deepEqual(t.post(3), t.post(2), "the re-sent request (the same body as the failed tick)");
      t.ok(t.posts().length >= 5, "no tick after the retried request's response - the Retry must take the repeating timer up again");
      t.equal(t.front(4).EVENT, "TICK", "S_FRONT.EVENT after the Retry");
      await noMorePosts(t, 5, 1500, "POSTs after the response with STOP_TIMER");
    },
  },
];
