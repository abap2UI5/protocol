// spec/actions.md - follow-up actions (T_CUSTOM).
const A = "spec/actions.md";
import { customActions, systemActions } from "../client.mjs";

export default [
  {
    id: "action.follow-up",
    title: "A follow-up action is a JSON array [\"<ACTION>\", <args>...] in T_CUSTOM",
    level: "MUST",
    profile: "core",
    spec: `${A}#follow-up-actions`,
    async run(t) {
      const r = await t.event(await t.start("ACTIONS"), "FOCUS");
      t.deepEqual(customActions(r), [["SET_FOCUS", "inp"]], "T_CUSTOM");
      t.equal(systemActions(r).length, 0, "no system action");
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
      t.deepEqual(customActions(r), [["SET_TITLE", "conformance title"], ["MESSAGE_TOAST", "show", "between"], ["SET_FOCUS", "inp"]], "T_CUSTOM");
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
      t.deepEqual(customActions(timer), [["START_TIMER", "TICK", "500"]], "T_CUSTOM");
      const tick = await t.event(timer, "TICK");
      t.equal(tick.json.MODEL && tick.json.MODEL.TICKS, 1, "MODEL.TICKS after the timer event");
    },
  },
];
