// spec/transport.md - the HTTP layer of a roundtrip.
const T = "spec/transport.md";

export default [
  {
    id: "transport.post-json",
    title: "An app-start POST is answered 200 with a JSON roundtrip response",
    level: "MUST",
    profile: "core",
    spec: `${T}#the-roundtrip-post`,
    async run(t) {
      const r = await t.client.start(t.apps.ECHO);
      t.equal(r.status, 200, "HTTP status");
      t.ok(/^application\/json\b/i.test(r.headers["content-type"] || ""), `Content-Type must be application/json, is "${r.headers["content-type"]}"`);
      t.ok(r.json && r.json.S_FRONT, "the body must be a JSON object with S_FRONT");
    },
  },
  {
    id: "transport.no-store",
    title: "A roundtrip response is not cacheable",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#response-headers-and-caching`,
    async run(t) {
      const r = await t.start("ECHO");
      t.ok(/no-store/i.test(r.headers["cache-control"] || ""), `Cache-Control should contain no-store, is "${r.headers["cache-control"] || ""}"`);
    },
  },
  {
    id: "transport.envelope-optional",
    title: "The bare payload (no { value } envelope) is accepted like the wrapped one",
    level: "MUST",
    profile: "core",
    spec: `${T}#the-envelope`,
    async run(t) {
      const r = t.roundtrip(await t.client.post({ S_FRONT: t.client.location({ search: `?app_start=${t.apps.ECHO}` }) }, { envelope: false, label: "start without envelope" }), "start without envelope");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
      const e = t.roundtrip(await t.client.post({ S_FRONT: { ID: r.json.S_FRONT.ID, EVENT: "ECHO", T_EVENT_ARG: ["bare"] } }, { envelope: false, label: "event without envelope" }), "event without envelope");
      t.equal(e.json.MODEL && e.json.MODEL.LAST_ARGS, "bare", "MODEL.LAST_ARGS after an event without envelope");
    },
  },
  {
    id: "transport.empty-body",
    title: "A POST without body, or with {}, is answered like an app start without a class",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#bodies-a-backend-must-tolerate`,
    async run(t) {
      for (const [label, body] of [["no body", undefined], ["{}", "{}"], ["no S_FRONT", JSON.stringify({ value: {} })]]) {
        const r = await t.client.raw({ method: "POST", body, headers: { "content-type": "application/json" }, label: `POST ${label}` });
        t.roundtrip(r, `POST with ${label}`);
        t.ok(r.json.S_FRONT.ID, `POST with ${label}: S_FRONT.ID`);
      }
    },
  },
  {
    id: "transport.invalid-json",
    title: "A body that is not JSON is refused with an error status",
    level: "MUST",
    profile: "core",
    spec: `${T}#bodies-a-backend-must-tolerate`,
    async run(t) {
      const r = await t.client.raw({ method: "POST", body: "this is not json", headers: { "content-type": "application/json" }, label: "POST not json" });
      t.ok(r.status >= 400, `expected an error status (4xx/5xx), got ${r.status}`);
    },
  },
  {
    id: "transport.csrf-origin",
    title: "A POST whose Origin names another host is refused with 403",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#csrf-and-origin`,
    async run(t) {
      const r = await t.client.post({ S_FRONT: t.client.location({ search: `?app_start=${t.apps.ECHO}` }) }, {
        headers: { origin: "https://cross-origin.invalid" }, label: "start from a foreign origin",
      });
      t.equal(r.status, 403, "HTTP status of a cross-origin POST");
      const same = await t.client.post({ S_FRONT: t.client.location({ search: `?app_start=${t.apps.ECHO}` }) }, {
        headers: { origin: t.client.origin }, label: "start from the same origin",
      });
      t.equal(same.status, 200, "HTTP status of a same-origin POST");
    },
  },
  {
    id: "transport.head-terminate",
    title: "HEAD with sap-terminate: session is answered 2xx without a body",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#head-session-terminate-and-token-fetch`,
    async run(t) {
      const r = await t.client.raw({ method: "HEAD", headers: { "sap-terminate": "session" }, label: "HEAD terminate" });
      t.ok(r.status >= 200 && r.status < 300, `expected 2xx, got ${r.status}`);
    },
  },
  {
    id: "transport.method-not-allowed",
    title: "A method other than GET, POST and HEAD is refused",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#other-methods`,
    async run(t) {
      for (const method of ["PUT", "DELETE", "OPTIONS"]) {
        const r = await t.client.raw({ method, label: method });
        t.ok(r.status >= 400, `${method}: expected an error status (405), got ${r.status}`);
      }
    },
  },
];
