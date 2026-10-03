// spec/transport.md - headers, stateful sessions, CSRF, retries, one roundtrip at a time.
import { recorded, answer } from "../responses.mjs";
import { BIND, CHECK, startBind, startApp, app, NEXT, nextButton } from "./common.mjs";

const T = "spec/transport.md";

export default [
  {
    id: "transport.contextid-accept",
    title: "Every roundtrip POST asks for the session id in a header (sap-contextid-accept: header)",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#request-headers`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      for (const r of t.posts()) t.equal(r.headers["sap-contextid-accept"], "header", "sap-contextid-accept");
    },
  },
  {
    id: "transport.contextid-only-when-held",
    title: "sap-contextid is not sent before the backend handed one out, and never empty",
    level: "MUST",
    profile: "core",
    spec: `${T}#request-headers`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.posts().forEach((r, i) => t.ok(!("sap-contextid" in r.headers), `request #${i + 1} sends sap-contextid: ${JSON.stringify(r.headers["sap-contextid"])} - none was handed out`));
    },
  },
  {
    id: "transport.contextid-kept",
    title: "The last sap-contextid response header is sent with every later POST; a response without it keeps it",
    level: "MUST",
    profile: "core",
    spec: `${T}#stateful-sessions-sap-contextid`,
    async run(t) {
      const first = app(nextButton);
      first.headers = { "sap-contextid": "SID:ANON:conformance_1" };
      t.mock.reply(first);
      await t.start("Z2UI5_CL_CONF_FE");
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE" }));
      await t.press(NEXT);
      t.mock.reply({ ...answer({ app: "Z2UI5_CL_CONF_FE" }), headers: { "sap-contextid": "SID:ANON:conformance_2" } });
      await t.press(NEXT);
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE" }));
      await t.press(NEXT);
      await t.posted(4);
      const sent = t.posts().map((r) => r.headers["sap-contextid"]);
      t.deepEqual(sent, [undefined, "SID:ANON:conformance_1", "SID:ANON:conformance_1", "SID:ANON:conformance_2"], "sap-contextid of the four requests");
    },
  },
  {
    id: "transport.csrf-token",
    title: "A 403 with X-CSRF-Token: Required is answered by a token fetch (HEAD) and the same body once more",
    level: "SHOULD",
    profile: "core",
    spec: `${T}#csrf-and-origin`,
    async run(t) {
      t.mock.requireCsrf("conformance-token-1");
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      const heads = t.mock.heads();
      t.ok(heads.some((h) => String(h.headers["x-csrf-token"] || "").toLowerCase() === "fetch"), "no HEAD with X-CSRF-Token: Fetch after the 403");
      const posts = t.posts();
      t.ok(posts.length >= 2, `expected the refused POST and its re-send, got ${posts.length} POST(s)`);
      t.equal(posts[1].text, posts[0].text, "the re-sent body");
      t.equal(posts[1].headers["x-csrf-token"], "conformance-token-1", "X-CSRF-Token of the re-send");
      await t.press(CHECK);
      await t.posted(3);
      t.equal(t.posts()[2].headers["x-csrf-token"], "conformance-token-1", "X-CSRF-Token of the next POST");
      const s = await t.state();
      t.ok(!s.error, `the frontend shows an error: ${s.error && s.error.text}`);
    },
  },
  {
    id: "transport.csrf-final",
    title: "A 403 without X-CSRF-Token: Required (the backend's own gate) is final - no re-send",
    level: "MUST",
    profile: "core",
    spec: `${T}#csrf-and-origin`,
    allowUnexpected: true,
    async run(t) {
      t.mock.requireCsrf("never", { final: true });
      t.mock.reply(recorded("model.scalar", 0));
      await t.start(BIND);
      await t.wait(1000);
      t.equal(t.posts().length, 1, "POSTs after a final 403");
      t.equal(t.mock.heads().length, 0, "HEAD token fetches after a final 403");
    },
  },
  {
    id: "transport.no-retry-500",
    title: "A 500 is not re-sent automatically",
    level: "MUST",
    profile: "core",
    spec: `${T}#client-behaviour`,
    allowUnexpected: true,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("session.failed-roundtrip-not-persisted", 1));
      await t.press(CHECK);
      await t.wait(1500);
      t.equal(t.posts().length, 2, "POSTs after the 500 (the app start and the failed event)");
    },
  },
  {
    id: "transport.one-at-a-time",
    title: "While a roundtrip is in flight, a second user event starts no second roundtrip",
    level: "MUST",
    profile: "core",
    needs: ["concurrent"],
    spec: `${T}#client-behaviour`,
    allowUnexpected: true,
    async run(t) {
      await startApp(t, `${nextButton}<Button text="Other" press=".eB(['OTHER'])"/>`);
      const held = t.mock.replyHeld(answer({ app: "Z2UI5_CL_CONF_FE" }));
      await t.press(NEXT, { wait: false });
      await held.received;
      try {
        await t.press({ text: "Other", event: "OTHER" }, { wait: false });
      } catch (e) {
        if (e.name !== "Unsupported") throw e;
      }
      await t.wait(400);
      const during = t.posts().length;
      held.release();
      await t.settle();
      t.equal(during, 2, "POSTs while the first event was in flight (app start + that event)");
    },
  },
];
