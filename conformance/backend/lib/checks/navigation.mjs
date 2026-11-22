// spec/navigation.md - the app stack, routes and the app-state hash.
const N = "spec/navigation.md";
import { displayOf, nav, actions } from "../client.mjs";

const FAKE_DRAFT = "0123456789ABCDEF0123456789ABCDEF";

export default [
  {
    id: "nav.call",
    title: "nav_app_call hands the screen to the called app: its APP, its MAIN view, its model",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-app-stack`,
    async run(t) {
      const r = await t.event(await t.start("NAV"), "CALL");
      t.equal(r.json.S_FRONT.APP, t.apps.NAV_TGT, "S_FRONT.APP");
      t.ok(displayOf(r, "MAIN"), "the called app's MAIN display");
      // only what the called app binds is its model - HAS_PREV is an
      // attribute it does not bind
      t.deepEqual(r.json.MODEL, { INPUT: "from caller", OUTPUT: "" }, "MODEL (the called app's bound attributes, preset by the caller)");
    },
  },
  {
    id: "nav.leave-with-result",
    title: "nav_app_leave returns to the caller, which re-displays and reads the result",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-app-stack`,
    async run(t) {
      const called = await t.event(await t.start("NAV"), "CALL");
      const r = await t.event(called, "DONE");
      t.equal(r.json.S_FRONT.APP, t.apps.NAV, "S_FRONT.APP");
      t.ok(displayOf(r, "MAIN"), "the caller's MAIN display");
      t.deepEqual(r.json.MODEL, { RESULT: "from caller!", RETURNS: 1 }, "MODEL of the caller");
    },
  },
  {
    id: "nav.leave-reserved-event",
    title: "The reserved event ___ZZZ_NAL leaves the app without running it",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-reserved-leave-event`,
    async run(t) {
      const called = await t.event(await t.start("NAV"), "CALL");
      const r = await t.event(called, "___ZZZ_NAL");
      t.equal(r.json.S_FRONT.APP, t.apps.NAV, "S_FRONT.APP");
      t.ok(displayOf(r, "MAIN"), "the caller's MAIN display");
      t.deepEqual(r.json.MODEL, { RESULT: "", RETURNS: 0 }, "MODEL of the caller (no result)");
    },
  },
  {
    id: "nav.leave-is-back",
    title: "The MAIN display of a return to a stacked app is marked navBack",
    level: "SHOULD",
    profile: "core",
    spec: `${N}#the-app-stack`,
    async run(t) {
      const r = await t.event(await t.event(await t.start("NAV"), "CALL"), "DONE");
      const d = displayOf(r, "MAIN");
      t.equal(d && d.OPT && d.OPT.navBack, true, "OPT.navBack of the MAIN display");
    },
  },
  {
    id: "route.mode",
    title: "An app that switches hash routing on sends NAV { setNavRouting }",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-nav-section`,
    async run(t) {
      const r = await t.start("ROUTE");
      t.deepEqual(nav(r), { setNavRouting: "KEEP" }, "S_FRONT.NAV");
    },
  },
  {
    id: "route.mode-not-repeated",
    title: "A plain event of a routed app does not repeat the routing mode",
    level: "SHOULD",
    profile: "core",
    spec: `${N}#the-nav-section`,
    async run(t) {
      const r = await t.event(await t.start("ROUTE"), "COUNT");
      t.equal(nav(r), undefined, "S_FRONT.NAV of a plain event");
    },
  },
  {
    id: "route.call-push",
    title: "A nav_app_call under routing asks for a history push and names the caller's fresh draft",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-nav-section`,
    async run(t) {
      const r = await t.event(await t.start("ROUTE"), "CALL");
      const o = nav(r) || {};
      t.equal(r.json.S_FRONT.APP, t.apps.NAV_TGT, "S_FRONT.APP");
      t.equal(o.checkNavAppCall, true, "checkNavAppCall");
      t.equal(o.navAppCallPrevApp, t.apps.ROUTE, "navAppCallPrevApp");
      t.ok(typeof o.navAppCallPrevId === "string" && o.navAppCallPrevId.length > 0, "navAppCallPrevId must name a draft");
      t.equal(o.setNavRouting, "KEEP", "setNavRouting (inherited by the called app)");
    },
  },
  {
    id: "route.start-by-class",
    title: "A request without ID whose ROUTE names a class starts that class",
    level: "MUST",
    profile: "core",
    spec: `${N}#which-app-a-request-starts`,
    async run(t) {
      const r = t.roundtrip(await t.client.start("", { search: "", hash: `#/app/${t.apps.ECHO}`, route: { APP: t.apps.ECHO } }), "start by route");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 0, "MODEL.COUNT of a fresh app");
    },
  },
  {
    id: "route.precedence",
    title: "ROUTE wins over ?app_start= in SEARCH",
    level: "MUST",
    profile: "core",
    spec: `${N}#which-app-a-request-starts`,
    async run(t) {
      const r = t.roundtrip(await t.client.start(t.apps.BIND, { hash: `#/app/${t.apps.ECHO}`, route: { APP: t.apps.ECHO } }), "start with both");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
    },
  },
  {
    id: "route.restore-draft",
    title: "ROUTE { APP, DRAFT } restores that draft and displays it",
    level: "MUST",
    profile: "core",
    spec: `${N}#routes`,
    async run(t) {
      const counted = await t.event(await t.start("ROUTE"), "COUNT");
      const r = t.roundtrip(await t.client.start("", { search: "", hash: `#/app/${t.apps.ROUTE}/${counted.json.S_FRONT.ID}`, route: { APP: t.apps.ROUTE, DRAFT: counted.json.S_FRONT.ID } }), "route restore");
      t.equal(r.json.S_FRONT.APP, t.apps.ROUTE, "S_FRONT.APP");
      t.ok(displayOf(r, "MAIN"), "the restored app displays MAIN");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 1, "MODEL.COUNT of the restored draft");
      t.ok(r.json.S_FRONT.ID !== counted.json.S_FRONT.ID, "the restore answers with a new draft id");
    },
  },
  {
    id: "route.expired-draft",
    title: "A route to a draft that does not exist starts the class fresh, with a toast",
    level: "MUST",
    profile: "core",
    spec: `${N}#routes`,
    async run(t) {
      const r = t.roundtrip(await t.client.start("", { search: "", hash: `#/app/${t.apps.ECHO}/${FAKE_DRAFT}`, route: { APP: t.apps.ECHO, DRAFT: FAKE_DRAFT } }), "route to a missing draft");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP");
      t.equal(r.json.MODEL && r.json.MODEL.COUNT, 0, "MODEL.COUNT of a fresh app");
      const toast = actions(r).find((a) => a[0] === "MESSAGE_TOAST");
      t.ok(toast, "a MESSAGE_TOAST tells the user the state is gone (SHOULD, checked here as part of the fallback)");
    },
  },
  {
    id: "route.hash-not-read",
    title: "HASH is not what an app start is resolved from: a route in HASH without ROUTE starts what SEARCH names",
    level: "MUST",
    profile: "core",
    spec: `${N}#which-app-a-request-starts`,
    async run(t) {
      const r = t.roundtrip(await t.client.start(t.apps.BIND, { hash: `#/app/${t.apps.ECHO}` }), "start with a route in HASH only");
      t.equal(r.json.S_FRONT.APP, t.apps.BIND, "S_FRONT.APP");
      const state = await t.event(await t.start("ECHO"), "ECHO", { args: ["kept"] });
      const fresh = t.roundtrip(await t.client.start(t.apps.ECHO, { hash: `#/z2ui5-xapp-state=${state.json.S_FRONT.ID}` }), "start with an app-state hash in HASH only");
      t.equal(fresh.json.MODEL && fresh.json.MODEL.LAST_ARGS, "", "MODEL.LAST_ARGS (a fresh app, the draft HASH names is not restored)");
    },
  },
  {
    id: "route.app-state",
    title: "ROUTE { APP_STATE } restores the draft and keeps the app-state hash on",
    level: "MUST",
    profile: "core",
    spec: `${N}#the-app-state-hash`,
    async run(t) {
      const echoed = await t.event(await t.start("ECHO"), "ECHO", { args: ["kept"] });
      const r = t.roundtrip(await t.client.start(t.apps.ECHO, { hash: `#/z2ui5-xapp-state=${echoed.json.S_FRONT.ID}`, route: { APP_STATE: echoed.json.S_FRONT.ID } }), "app-state restore");
      t.equal(r.json.MODEL && r.json.MODEL.LAST_ARGS, "kept", "MODEL.LAST_ARGS of the restored draft");
      t.equal((nav(r) || {}).setAppStateActive, true, "NAV.setAppStateActive");
      const next = await t.event(r, "NOOP");
      t.equal((nav(next) || {}).setAppStateActive, true, "setAppStateActive is re-asserted on the next response");
    },
  },
  {
    id: "route.app-state-names-no-app",
    title: "ROUTE { APP_STATE } restores the draft when the request names no app; a draft that is gone ends on the start app, with a toast",
    level: "SHOULD",
    profile: "core",
    spec: `${N}#the-app-state-hash`,
    async run(t) {
      const echoed = await t.event(await t.start("ECHO"), "ECHO", { args: ["kept"] });
      const r = t.roundtrip(await t.client.start("", { search: "", hash: `#/z2ui5-xapp-state=${echoed.json.S_FRONT.ID}`, route: { APP_STATE: echoed.json.S_FRONT.ID } }), "app-state restore without ?app_start=");
      t.equal(r.json.S_FRONT.APP, t.apps.ECHO, "S_FRONT.APP of the restored draft");
      t.equal(r.json.MODEL && r.json.MODEL.LAST_ARGS, "kept", "MODEL.LAST_ARGS of the restored draft");
      t.equal((nav(r) || {}).setAppStateActive, true, "NAV.setAppStateActive");
      const gone = t.roundtrip(await t.client.start("", { search: "", hash: `#/z2ui5-xapp-state=${FAKE_DRAFT}`, route: { APP_STATE: FAKE_DRAFT } }), "app-state hash of a missing draft, no app named");
      t.ok(displayOf(gone, "MAIN"), "a MAIN display of the start app");
      t.ok(actions(gone).find((a) => a[0] === "MESSAGE_TOAST"), "a MESSAGE_TOAST tells the user the state is gone");
    },
  },
  {
    id: "nav.system-startup",
    title: "An app start that names no app is answered with a start app",
    level: "SHOULD",
    profile: "core",
    spec: `${N}#which-app-a-request-starts`,
    async run(t) {
      const r = t.roundtrip(await t.client.start("", { search: "" }), "start without app");
      t.ok(displayOf(r, "MAIN"), "a MAIN display");
      t.ok(typeof r.json.S_FRONT.APP === "string" && r.json.S_FRONT.APP.length > 0, "S_FRONT.APP names the start app");
    },
  },
];
