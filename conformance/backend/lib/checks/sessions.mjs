// spec/sessions.md - drafts and their ids.
import { actions } from "../client.mjs";

const S = "spec/sessions.md";

const FAKE_DRAFT = "0123456789ABCDEF0123456789ABCDEF";

export default [
  {
    id: "session.new-id",
    title: "Every response names a draft id other than the one the request continued",
    level: "MUST",
    profile: "core",
    spec: `${S}#draft-ids`,
    async run(t) {
      const start = await t.start("ECHO");
      const one = await t.event(start, "ECHO");
      const two = await t.event(one, "NOOP");
      t.ok(one.json.S_FRONT.ID !== start.json.S_FRONT.ID, "the first event's id differs from the start's");
      t.ok(two.json.S_FRONT.ID !== one.json.S_FRONT.ID, "an event that changed nothing still answers a new id");
    },
  },
  {
    id: "session.timer-tick",
    title: "A timer tick (S_FRONT.TIMER) that changed the app state answers a new id; one that changed nothing may answer the id it continued, and the state carries over either way",
    level: "MUST",
    profile: "core",
    spec: `${S}#draft-ids`,
    async run(t) {
      const start = await t.start("ECHO");
      const one = await t.event(start, "ECHO");
      // NOOP changes nothing: the one roundtrip that MAY answer the id it continued
      const idle = await t.event(one, "NOOP", { timer: true, label: "tick NOOP" });
      t.ok(typeof idle.json.S_FRONT.ID === "string" && idle.json.S_FRONT.ID !== "", "the unchanged tick answers a draft id");
      // ECHO counts: a tick that changed the app state is no exception
      const counted = await t.event(idle, "ECHO", { timer: true, label: "tick ECHO" });
      t.ok(counted.json.S_FRONT.ID !== idle.json.S_FRONT.ID, "a tick that changed the app state answers a new id");
      t.equal(counted.json.MODEL && counted.json.MODEL.COUNT, 2, "MODEL.COUNT continued through the unchanged tick");
      const after = await t.event(counted, "ECHO");
      t.ok(after.json.S_FRONT.ID !== counted.json.S_FRONT.ID, "an event without TIMER answers a new id");
      t.equal(after.json.MODEL && after.json.MODEL.COUNT, 3, "MODEL.COUNT after the ticks");
    },
  },
  {
    id: "session.continuation",
    title: "State carries over from roundtrip to roundtrip through the draft id",
    level: "MUST",
    profile: "core",
    spec: `${S}#draft-ids`,
    async run(t) {
      let r = await t.start("ECHO");
      for (let i = 0; i < 3; i += 1) r = await t.event(r, "ECHO");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 3, "MODEL.COUNT after three events");
    },
  },
  {
    id: "session.id-reuse",
    title: "The draft before the newest continues from the state it named (the retry of a lost response)",
    level: "MUST",
    profile: "core",
    spec: `${S}#drafts-are-snapshots`,
    async run(t) {
      const start = await t.start("ECHO");
      const one = await t.event(start, "ECHO", { args: ["first"] });
      await t.event(one, "ECHO", { args: ["second"] });
      const again = t.roundtrip(await t.client.event(one.json.S_FRONT.ID, "ECHO", { args: ["again"] }), "event on the earlier id");
      t.equal(again.json.MODEL && again.json.MODEL.COUNT, 2, "MODEL.COUNT continued from the earlier draft");
      t.equal(again.json.MODEL.LAST_ARGS, "again", "MODEL.LAST_ARGS");
    },
  },
  {
    id: "session.retention-protected",
    title: "A protected draft outlives the chain behind it: the draft a route restored, and the caller on the app stack, after three more roundtrips",
    level: "MUST",
    profile: "core",
    spec: `${S}#retention`,
    async run(t) {
      // a route restore: the restored draft is protected, however long the
      // chain that starts from it grows
      const counted = await t.event(await t.start("ROUTE"), "COUNT");
      const id = counted.json.S_FRONT.ID;
      const route = () => t.client.start("", { search: "", hash: `#/app/${t.apps.ROUTE}/${id}`, route: { APP: t.apps.ROUTE, DRAFT: id } });
      let r = t.roundtrip(await route(), "route restore");
      for (let i = 0; i < 3; i += 1) r = await t.event(r, "COUNT");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 4, "MODEL.COUNT after three roundtrips on the restored draft");
      const again = t.roundtrip(await route(), "the same route once more");
      t.equal(again.json.MODEL && again.json.MODEL.COUNT, 1, "MODEL.COUNT of the draft the route names, restored once more");
      t.ok(actions(again).every((a) => a[0] !== "MESSAGE_TOAST"), "the draft the route names is not gone (no toast of a fresh start)");
      // the app stack: the caller survives three roundtrips of the called app
      let called = await t.event(await t.start("NAV"), "CALL");
      for (let i = 0; i < 3; i += 1) called = await t.event(called, "IDLE");
      const back = await t.event(called, "DONE");
      t.equal(back.json.S_FRONT.APP, t.apps.NAV, "S_FRONT.APP after the leave");
      t.deepEqual(back.json.MODEL, { RESULT: "from caller!", RETURNS: 1 }, "MODEL of the caller");
    },
  },
  {
    id: "session.unknown-draft",
    title: "An event on a draft id the backend never issued is refused with an error status",
    level: "MUST",
    profile: "core",
    spec: `${S}#unknown-and-expired-drafts`,
    async run(t) {
      const r = await t.client.event(FAKE_DRAFT, "ECHO");
      t.ok(r.status >= 400, `expected an error status, got ${r.status}`);
      t.ok(!(r.json && r.json.S_FRONT), "the error must not be a roundtrip response");
    },
  },
  {
    id: "session.failed-roundtrip-not-persisted",
    title: "A roundtrip that fails leaves the draft it started from usable, its changes discarded",
    level: "MUST",
    profile: "core",
    spec: `${S}#failed-roundtrips`,
    async run(t) {
      const start = await t.start("ERROR");
      const failed = await t.client.event(start.json.S_FRONT.ID, "FAIL");
      t.ok(failed.status >= 500, `FAIL: expected a 5xx error, got ${failed.status}`);
      const r = t.roundtrip(await t.client.event(start.json.S_FRONT.ID, "COUNT"), "COUNT on the same id");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 1, "MODEL.COUNT (the failed roundtrip's increment is not kept)");
    },
  },
];
