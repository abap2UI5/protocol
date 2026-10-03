// spec/request.md, spec/transport.md#the-envelope - what a frontend sends.
import { recorded, answer, button } from "../responses.mjs";
import { CHECK, ADD_ROW, startBind, startApp, ids, hasOwn, NEXT, nextButton } from "./common.mjs";

const R = "spec/request.md";
const T = "spec/transport.md";

export default [
  {
    id: "request.envelope",
    title: "Every roundtrip POST is wrapped in the { value: ... } envelope",
    level: "MUST",
    profile: "core",
    spec: `${T}#the-envelope`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      for (const r of t.posts()) {
        t.ok(r.json && typeof r.json === "object" && !Array.isArray(r.json), `a POST body is no JSON object: ${r.text.slice(0, 200)}`);
        t.deepEqual(Object.keys(r.json), ["value"], "the keys of the POST body");
      }
    },
  },
  {
    id: "request.content-type",
    title: "Every roundtrip POST is sent with Content-Type: application/json",
    level: "MUST",
    profile: "core",
    spec: `${T}#the-roundtrip-post`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      for (const r of t.posts()) t.ok(/^application\/json\b/i.test(r.headers["content-type"] || ""), `Content-Type: ${r.headers["content-type"]}`);
    },
  },
  {
    id: "request.app-start",
    title: "The first request starts the app: no ID, ?app_start=<CLASS> in SEARCH",
    level: "MUST",
    profile: "core",
    spec: `${R}#app-start-shaped-requests`,
    async run(t) {
      await startBind(t);
      const f = t.front(0);
      t.ok(!f.ID, `the app start carries ID ${f.ID}`);
      t.ok(!f.EVENT, `the app start carries EVENT ${f.EVENT}`);
      t.ok(/[?&]app_start=Z2UI5_CL_CONF_BIND(&|$)/i.test(f.SEARCH || "") || /^#\/*app\/Z2UI5_CL_CONF_BIND\b/i.test(f.HASH || ""),
        `the app start names no class: SEARCH ${JSON.stringify(f.SEARCH)}, HASH ${JSON.stringify(f.HASH)}`);
    },
  },
  {
    id: "request.app-start-location",
    title: "The app start carries the endpoint's ORIGIN and PATHNAME",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#app-start-shaped-requests`,
    async run(t) {
      await startBind(t);
      const f = t.front(0);
      t.equal(f.ORIGIN, t.mock.mock.origin, "S_FRONT.ORIGIN");
      t.equal(f.PATHNAME, t.mock.path, "S_FRONT.PATHNAME");
    },
  },
  {
    id: "request.event",
    title: "A user event sends EVENT as the wire names it and the ID of the last response",
    level: "MUST",
    profile: "core",
    spec: `${R}#event-requests`,
    async run(t) {
      const first = await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      await t.posted(2);
      const f = t.front(1);
      t.equal(f.EVENT, "CHECK", "S_FRONT.EVENT");
      t.equal(f.ID, first.S_FRONT.ID, "S_FRONT.ID");
    },
  },
  {
    id: "request.id-continuation",
    title: "Every event continues the ID of the response adopted last - also an ID seen before",
    level: "MUST",
    profile: "core",
    spec: "spec/sessions.md#draft-ids",
    async run(t) {
      const first = await startApp(t, nextButton);
      const a = answer({ app: "Z2UI5_CL_CONF_FE" });
      const b = answer({ app: "Z2UI5_CL_CONF_FE" });
      // a leave answers the id the caller was saved under - an id seen before
      const again = answer({ app: "Z2UI5_CL_CONF_FE", id: a.body.S_FRONT.ID });
      for (const r of [a, b, again, answer({ app: "Z2UI5_CL_CONF_FE" })]) t.mock.reply(r);
      for (let i = 0; i < 4; i += 1) await t.press(NEXT);
      await t.posted(5);
      t.deepEqual(ids(t), [undefined, first.S_FRONT.ID, a.body.S_FRONT.ID, b.body.S_FRONT.ID, a.body.S_FRONT.ID], "the S_FRONT.ID of the five requests");
    },
  },
  {
    id: "request.location-once",
    title: "Event requests leave out ORIGIN, PATHNAME and SEARCH",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#s_front`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.mock.reply(recorded("model.table-grows", 1));
      await t.press(ADD_ROW);
      for (const i of [1, 2]) {
        const f = t.front(i);
        for (const k of ["ORIGIN", "PATHNAME", "SEARCH"]) t.ok(!hasOwn(f, k), `event request #${i + 1} carries ${k}`);
      }
    },
  },
  {
    id: "request.event-arguments",
    title: "T_EVENT_ARG holds the wire's arguments in order as raw JSON values (true stays true)",
    level: "MUST",
    profile: "core",
    spec: `${R}#event-arguments`,
    async run(t) {
      const wire = button("Args", "ARGS", ["alpha", "", "${/COUNT}", "${/FLAG}", "${/OFF}", "${/NAME}"]);
      await startApp(t, `<Text text="{/NAME}"/>${wire}`, { model: { COUNT: 3, FLAG: true, OFF: false, NAME: "Ada" } });
      t.mock.reply(answer({ app: "Z2UI5_CL_CONF_FE" }));
      await t.press({ text: "Args", event: "ARGS" });
      await t.posted(2);
      t.deepEqual(t.front(1).T_EVENT_ARG, ["alpha", "", 3, true, false, "Ada"], "S_FRONT.T_EVENT_ARG");
    },
  },
  {
    id: "request.event-no-arguments",
    title: "An event whose wire has no arguments sends no T_EVENT_ARG",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#shape`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.ok(!hasOwn(t.front(1), "T_EVENT_ARG"), `T_EVENT_ARG: ${JSON.stringify(t.front(1).T_EVENT_ARG)}`);
    },
  },
  {
    id: "request.leave-event",
    title: "The leave wire (navButtonPress .eB(['___ZZZ_NAL'])) sends the reserved event ___ZZZ_NAL",
    level: "MUST",
    profile: "core",
    spec: "spec/navigation.md#the-reserved-leave-event",
    async run(t) {
      // the called app of the recorded NAV pair: a Page with a nav button
      t.mock.reply(recorded("nav.leave-reserved-event", 1));
      await t.start("Z2UI5_CL_CONF_NAV_TGT");
      t.mock.reply(recorded("nav.leave-reserved-event", 2));
      await t.press({ nav: true, event: "___ZZZ_NAL" });
      await t.posted(2);
      t.equal(t.front(1).EVENT, "___ZZZ_NAL", "S_FRONT.EVENT");
    },
  },
  {
    id: "request.client-prev",
    title: "MS_CLIENT_PREV, when sent, is a non-negative integer and never on the first request",
    level: "MUST",
    profile: "core",
    spec: `${R}#s_front`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.ok(!hasOwn(t.front(0), "MS_CLIENT_PREV"), "the first request carries MS_CLIENT_PREV - there was no previous roundtrip");
      const v = t.front(1).MS_CLIENT_PREV;
      if (v !== undefined) t.ok(Number.isInteger(v) && v >= 0, `MS_CLIENT_PREV: ${JSON.stringify(v)}`);
    },
  },
  {
    id: "request.no-empty-keys",
    title: "Empty values are left out (T_EVENT_ARG, SEARCH, HASH, MODEL, CONFIG)",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#shape`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.mock.reply(recorded("model.table-grows", 1));
      await t.press(ADD_ROW);
      t.posts().forEach((r, i) => {
        const p = (r.json && r.json.value) || {};
        const f = p.S_FRONT || {};
        const empty = (v) => v === "" || v === null || (Array.isArray(v) && !v.length) || (v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
        for (const k of ["T_EVENT_ARG", "SEARCH", "HASH", "CONFIG"]) t.ok(!(hasOwn(f, k) && empty(f[k])), `request #${i + 1}: S_FRONT.${k} is sent empty`);
        t.ok(!(hasOwn(p, "MODEL") && empty(p.MODEL)), `request #${i + 1}: MODEL is sent empty`);
      });
    },
  },
  {
    id: "request.config-cadence",
    title: "The static session block travels with the app start, not with every event",
    level: "SHOULD",
    profile: "core",
    spec: `${R}#config-the-session-block`,
    async run(t) {
      await startBind(t);
      t.mock.reply(recorded("model.scalar", 1));
      await t.press(CHECK);
      t.mock.reply(recorded("model.table-grows", 1));
      await t.press(ADD_ROW);
      const sent = t.posts().map((r) => ((r.json && r.json.value && r.json.value.S_FRONT) || {}).CONFIG);
      if (!sent.some(Boolean)) return; // a frontend MAY send no CONFIG at all
      const statics = (c) => {
        if (!c) return [];
        const out = [];
        if (c.S_UI5) out.push("S_UI5");
        if (c.ComponentData) out.push("ComponentData");
        for (const k of ["SYSTEM", "BROWSER", "OS", "SUPPORT"]) if (c.S_DEVICE && hasOwn(c.S_DEVICE, k)) out.push(`S_DEVICE.${k}`);
        return out;
      };
      t.ok(sent[0], "the frontend sends CONFIG with events but not with the app start");
      for (const i of [1, 2]) t.deepEqual(statics(sent[i]), [], `static blocks repeated by event request #${i + 1}`);
    },
  },
];
