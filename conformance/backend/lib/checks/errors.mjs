// spec/errors.md - how a backend says that a roundtrip failed.
const E = "spec/errors.md";

export default [
  {
    id: "error.app-exception",
    title: "An exception in the app is answered with a 5xx and a plain-text body",
    level: "MUST",
    profile: "core",
    spec: `${E}#the-error-response`,
    async run(t) {
      const start = await t.start("ERROR");
      const r = await t.client.event(start.json.S_FRONT.ID, "FAIL");
      t.ok(r.status >= 500 && r.status < 600, `expected 5xx, got ${r.status}`);
      t.ok(!(r.json && r.json.S_FRONT), "the error body must not be a roundtrip response");
      t.ok(r.text.trim().length > 0, "the error body must not be empty");
      t.ok(/^text\/plain\b/i.test(r.headers["content-type"] || ""), `Content-Type must be text/plain, is "${r.headers["content-type"]}"`);
    },
  },
  {
    id: "error.details",
    title: "The error body names the app or the failure, so a developer can find the cause",
    level: "SHOULD",
    profile: "core",
    spec: `${E}#the-error-response`,
    async run(t) {
      const start = await t.start("ERROR");
      const r = await t.client.event(start.json.S_FRONT.ID, "FAIL");
      t.ok(r.text.includes(t.apps.ERROR) || r.text.includes("CONFORMANCE_FAILURE"),
        `the body should name the app (${t.apps.ERROR}) or its failure unless details are hidden on purpose, is: ${r.text.slice(0, 120)}`);
    },
  },
  {
    id: "error.unknown-app",
    title: "An app start naming a class that is no app is refused with an error status",
    level: "MUST",
    profile: "core",
    spec: `${E}#the-error-response`,
    async run(t) {
      const r = await t.client.start("Z2UI5_CL_CONF_DOES_NOT_EXIST");
      t.ok(r.status >= 400, `expected an error status, got ${r.status}`);
      t.ok(!(r.json && r.json.S_FRONT), "the error must not be a roundtrip response");
    },
  },
  {
    id: "error.not-sniffable",
    title: "An error body is served as text/plain with X-Content-Type-Options: nosniff",
    level: "SHOULD",
    profile: "core",
    spec: `${E}#the-error-response`,
    async run(t) {
      // the reference reflects the request URL into the body verbatim - safe
      // only because nothing renders the body as markup
      const r = await t.client.start("Z2UI5_<b>x</b>");
      t.ok(r.status >= 400, `expected an error status, got ${r.status}`);
      t.ok(/^text\/plain\b/i.test(r.headers["content-type"] || ""), `Content-Type should be text/plain, is "${r.headers["content-type"]}"`);
      t.equal((r.headers["x-content-type-options"] || "").toLowerCase(), "nosniff", "X-Content-Type-Options");
    },
  },
];
