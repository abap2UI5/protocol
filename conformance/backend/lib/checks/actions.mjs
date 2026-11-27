// spec/actions.md - follow-up actions (S_FRONT.ACTIONS).
const A = "spec/actions.md";
import { actions, views, displayOf } from "../client.mjs";

// The repeating timer the app ACTIONS declares with TIMER_SET
// (timer_set( event = `TICK` delay_ms = 500 )), as the backend writes it.
const DECLARED = ["START_TIMER", "TICK", "500", "", "X"];
const starts = (r) => actions(r).filter((a) => a[0] === "START_TIMER");
const stops = (r) => actions(r).filter((a) => a[0] === "STOP_TIMER");

/**
 * The rules of a timer the backend keeps are MAY (spec/actions.md#a-timer-
 * the-backend-keeps): a check of them passes when the backend does what the
 * rule describes, skips when it does not do it at all, and warns when it
 * does it otherwise. Start ACTIONS and declare its timer; a backend that
 * sends nothing for the declaration keeps no timer - every check skips.
 */
async function declare(t) {
  const set = await t.event(await t.start("ACTIONS"), "TIMER_SET");
  if (!starts(set).length && !stops(set).length) t.skip("the backend sends nothing for a declared timer (timer_set( )) - it keeps none, a MAY");
  t.deepEqual(actions(set), [DECLARED], "S_FRONT.ACTIONS of the declaration (the repeating START_TIMER)");
  return set;
}
/** An app-state link of draft `id` of ACTIONS: a request without a draft id. */
const restore = async (t, id, label) => t.roundtrip(await t.client.start(t.apps.ACTIONS, {
  hash: `#/z2ui5-xapp-state=${id}`, route: { APP_STATE: id }, label,
}), label);
/** Every START_TIMER of `r` is the declared timer (spec/actions.md#the-timer, the same timer again). */
const onlyDeclared = (t, r, what) => t.ok(starts(r).every((a) => JSON.stringify(a) === JSON.stringify(DECLARED)), `${what}: a START_TIMER other than the declared timer: ${JSON.stringify(actions(r))}`);

export default [
  {
    id: "action.follow-up",
    title: "A follow-up action is a JSON array [\"<ACTION>\", <args>...] in S_FRONT.ACTIONS",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      const r = await t.event(await t.start("ACTIONS"), "FOCUS");
      t.deepEqual(actions(r), [["SET_FOCUS", "inp"]], "S_FRONT.ACTIONS");
      t.deepEqual(views(r), {}, "S_FRONT.VIEWS (a follow-up action displays nothing)");
    },
  },
  {
    id: "action.order",
    title: "Follow-up actions keep the order the app queued them in, messages included",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      const r = await t.event(await t.start("ACTIONS"), "SEVERAL");
      t.deepEqual(actions(r), [["SET_TITLE", "conformance title"], ["MESSAGE_TOAST", "show", "between"], ["SET_FOCUS", "inp"]], "S_FRONT.ACTIONS");
    },
  },
  {
    id: "action.timer",
    title: "A timer is [\"START_TIMER\", <event>, <ms>] and its event is an ordinary roundtrip",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      const timer = await t.event(await t.start("ACTIONS"), "TIMER");
      t.deepEqual(actions(timer), [["START_TIMER", "TICK", "500"]], "S_FRONT.ACTIONS");
      const tick = await t.event(timer, "TICK");
      t.equal(tick.json.MODEL && tick.json.MODEL.TICKS, 1, "MODEL.TICKS after the timer event");
    },
  },
  {
    id: "action.timer-repeat",
    title: "A repeating timer is [\"START_TIMER\", <event>, <ms>, \"\", \"X\"] - the empty no-busy flag keeps its place - and the stop is [\"STOP_TIMER\"]",
    level: "MUST",
    profile: "core",
    spec: `${A}#the-timer`,
    async run(t) {
      const start = await t.start("ACTIONS");
      const repeat = await t.event(start, "TIMER_REPEAT");
      t.deepEqual(actions(repeat), [["START_TIMER", "TICK", "500", "", "X"]], "S_FRONT.ACTIONS of the repeating timer");
      const stop = await t.event(repeat, "TIMER_STOP");
      t.deepEqual(actions(stop), [["STOP_TIMER"]], "S_FRONT.ACTIONS of the stop");
    },
  },
  {
    id: "action.timer-declared",
    title: "A timer the app declares goes out with the response that declares it, as the repeating START_TIMER; its ticks are ordinary ticks, and one that changed nothing may keep its draft id",
    level: "MAY",
    profile: "core",
    spec: `${A}#a-timer-the-backend-keeps`,
    async run(t) {
      const set = await declare(t);
      const tick = await t.event(set, "TICK", { timer: true, label: "tick TICK" });
      t.equal(tick.json.MODEL && tick.json.MODEL.TICKS, 1, "MODEL.TICKS after a tick");
      onlyDeclared(t, tick, "the tick");
      t.deepEqual(stops(tick), [], "STOP_TIMER in a tick's response (the timer is still declared)");
      // IDLE is no event of the app: the tick changes nothing
      const idle = await t.event(tick, "IDLE", { timer: true, label: "tick IDLE" });
      t.ok(typeof idle.json.S_FRONT.ID === "string" && idle.json.S_FRONT.ID !== "", "the unchanged tick answers a draft id");
      onlyDeclared(t, idle, "the unchanged tick");
      const again = await t.event(idle, "TICK", { timer: true, label: "tick TICK again" });
      t.equal(again.json.MODEL && again.json.MODEL.TICKS, 2, "MODEL.TICKS continued through the unchanged tick");
    },
  },
  {
    id: "action.timer-declared-restore",
    title: "A declared timer goes out again in the response to a request without a draft id - an app-state link of the app's draft",
    level: "MAY",
    profile: "core",
    spec: `${A}#a-timer-the-backend-keeps`,
    async run(t) {
      const set = await declare(t);
      const r = await restore(t, set.json.S_FRONT.ID, "app-state restore of the declaring draft");
      t.equal(r.json.S_FRONT.APP, t.apps.ACTIONS, "S_FRONT.APP of the restored draft");
      t.ok(displayOf(r, "MAIN"), "the restored app displays MAIN");
      if (!starts(r).length) t.skip("the backend does not send the declared timer again on a request without a draft id - a MAY");
      t.deepEqual(actions(r), [DECLARED], "S_FRONT.ACTIONS of the restore");
    },
  },
  {
    id: "action.timer-declared-return",
    title: "A declared timer goes out again when the app gets the screen back from an app it called",
    level: "MAY",
    profile: "core",
    spec: `${A}#a-timer-the-backend-keeps`,
    async run(t) {
      const called = await t.event(await declare(t), "CALL");
      t.equal(called.json.S_FRONT.APP, t.apps.NAV_TGT, "S_FRONT.APP of the called app");
      onlyDeclared(t, called, "the called app's response");
      const back = await t.event(called, "DONE");
      t.equal(back.json.S_FRONT.APP, t.apps.ACTIONS, "S_FRONT.APP after the leave");
      t.ok(displayOf(back, "MAIN"), "the caller displays MAIN");
      if (!starts(back).length) t.skip("the backend does not send the declared timer again when the app gets the screen back - a MAY");
      t.deepEqual(actions(back), [DECLARED], "S_FRONT.ACTIONS of the return");
    },
  },
  {
    id: "action.timer-declared-hop-stop",
    title: "A hop away from an app whose declared timer runs ends it with STOP_TIMER first in ACTIONS - before a START_TIMER the app navigated to queued itself, another instance of the same class included",
    level: "MAY",
    profile: "core",
    spec: `${A}#a-timer-the-backend-keeps`,
    async run(t) {
      // another class: the frontend ends the timer on the APP change anyway
      const other = await t.event(await declare(t), "CALL");
      t.equal(other.json.S_FRONT.APP, t.apps.NAV_TGT, "S_FRONT.APP of the called app");
      if (stops(other).length) t.deepEqual(actions(other), [["STOP_TIMER"]], "S_FRONT.ACTIONS of the hop to another class");
      // the same class: the APP does not change - only STOP_TIMER ends the
      // caller's timer, and the START_TIMER the new instance queued wins
      const self = await t.event(await declare(t), "CALL_SELF");
      t.equal(self.json.S_FRONT.APP, t.apps.ACTIONS, "S_FRONT.APP of the new instance");
      t.equal(self.json.MODEL && self.json.MODEL.TICKS, 0, "MODEL.TICKS of the new instance");
      if (!stops(self).length) t.skip("the backend sends no STOP_TIMER with a hop to another instance of the same class - a MAY");
      t.deepEqual(actions(self), [["STOP_TIMER"], ["START_TIMER", "TICK", "1000", "", "X"]], "S_FRONT.ACTIONS of the hop to another instance (the stop first, then the new instance's own timer)");
    },
  },
  {
    id: "action.timer-declared-stop",
    title: "timer_stop( ) of a declared timer that runs goes out as STOP_TIMER, and the timer is not sent again when the app gets the screen back",
    level: "MAY",
    profile: "core",
    spec: `${A}#a-timer-the-backend-keeps`,
    async run(t) {
      const unset = await t.event(await declare(t), "TIMER_UNSET");
      if (!stops(unset).length) t.skip("the backend sends no STOP_TIMER when the app ends its declared timer - a MAY");
      t.deepEqual(actions(unset), [["STOP_TIMER"]], "S_FRONT.ACTIONS of timer_stop( )");
      const r = await restore(t, unset.json.S_FRONT.ID, "app-state restore after timer_stop( )");
      t.ok(displayOf(r, "MAIN"), "the restored app displays MAIN");
      t.deepEqual(starts(r), [], "START_TIMER in the restore of an app that ended its timer");
    },
  },
];
