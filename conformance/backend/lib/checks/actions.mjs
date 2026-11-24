// spec/actions.md - follow-up actions (S_FRONT.ACTIONS).
const A = "spec/actions.md";
import { actions, views } from "../client.mjs";

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
];
