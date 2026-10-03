// spec/request.md - events and their arguments.
const Q = "spec/request.md";
import { hasModel } from "../client.mjs";

export default [
  {
    id: "event.roundtrip",
    title: "An event roundtrip reaches the app: EVENT is the event the app sees",
    level: "MUST",
    profile: "core",
    spec: `${Q}#event-requests`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "ECHO", { args: ["alpha", "beta"] });
      t.ok(hasModel(r), "the event changed bound data - MODEL must be present");
      t.equal(r.json.MODEL.LAST_EVENT, "ECHO", "MODEL.LAST_EVENT");
      t.equal(r.json.MODEL.COUNT, 1, "MODEL.COUNT");
      t.equal(r.json.MODEL.LAST_ARGS, "alpha|beta", "MODEL.LAST_ARGS");
    },
  },
  {
    id: "event.argument-conversion",
    title: "Event arguments of every JSON type reach the app as strings",
    level: "MUST",
    profile: "core",
    spec: `${Q}#event-arguments`,
    async run(t) {
      const args = ["text", 42, 1.5, true, false, null, { k: "v", n: [1, 2] }, [1, "a"], ""];
      const r = await t.event(await t.start("ECHO"), "ECHO", { args });
      t.equal(r.json.MODEL && r.json.MODEL.LAST_ARGS, 'text|42|1.5|X|||{"k":"v","n":[1,2]}|[1,"a"]|', "MODEL.LAST_ARGS");
    },
  },
  {
    id: "event.no-arguments",
    title: "An event without T_EVENT_ARG reaches the app with no arguments",
    level: "MUST",
    profile: "core",
    spec: `${Q}#event-arguments`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "ECHO");
      t.equal(r.json.MODEL && r.json.MODEL.LAST_ARGS, "", "MODEL.LAST_ARGS");
    },
  },
  {
    id: "event.argument-limit",
    title: "More than 100 event arguments are refused with an error status",
    level: "SHOULD",
    profile: "core",
    spec: `${Q}#event-arguments`,
    async run(t) {
      const start = await t.start("ECHO");
      const r = await t.client.post({ S_FRONT: { ID: start.json.S_FRONT.ID, EVENT: "ECHO", T_EVENT_ARG: Array.from({ length: 101 }, (_, i) => String(i)) } }, { label: "101 arguments" });
      t.client.exchanges[t.client.exchanges.length - 1].malformed = true;
      t.ok(r.status >= 400, `expected an error status, got ${r.status}`);
    },
  },
  {
    id: "event.unknown-event",
    title: "An event the app does not handle is answered normally",
    level: "MUST",
    profile: "core",
    spec: `${Q}#event-requests`,
    async run(t) {
      const r = await t.event(await t.start("ECHO"), "NO_SUCH_EVENT_IN_THIS_APP");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
    },
  },
];
