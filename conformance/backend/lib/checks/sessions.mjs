// spec/sessions.md - drafts and their ids.
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
    title: "An earlier draft id continues from the state it named (the retry of a lost response)",
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
