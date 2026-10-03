/*
 * The UI5 frontend's own request code, run in Node against a live backend:
 * app/webapp/core/Server.js, core/Session.js and core/Lib.js of an abap2UI5
 * checkout, loaded by stubbing sap.ui.define (the way abap2UI5's own
 * node/tests/loadModule.js loads them), with the real fetch. Nothing is
 * rendered - the MAIN controller is a stub that keeps the response record -
 * but every request body, header and response parse is the shipped code's.
 *
 * Used by scripts/record-traffic.mjs to record what the real frontend sends
 * (the CONFIG block, HASH, MS_CLIENT_PREV ...), which the suite's own client
 * does not. Not part of the published package.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function locateWebapp(home) {
  const dir = path.join(home, "app", "webapp");
  return fs.existsSync(path.join(dir, "core", "Server.js")) ? dir : null;
}

function loader(webapp, sandbox) {
  const context = vm.createContext({ URL, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, AbortSignal, ...sandbox });
  return (relPath, deps) => {
    const source = fs.readFileSync(path.join(webapp, relPath), "utf8");
    let exported;
    context.sap = { ui: { define: (names, factory) => { exported = factory(...names.map((n) => deps[n])); } } };
    vm.runInContext(source, context, { filename: relPath });
    if (!exported) throw new Error(`${relPath} did not register via sap.ui.define`);
    return exported;
  };
}

/**
 * A frontend session against `url`.
 *   location  { origin, pathname, search, hash } - what window.location says
 *   record    (exchange) => void - every fetch the frontend makes
 */
export function createUi5Frontend({ webapp, url, location, record = () => {} }) {
  const win = {
    location: { href: `${location.origin}${location.pathname}${location.search || ""}${location.hash || ""}`, ...location },
    innerWidth: 1280,
    innerHeight: 800,
  };
  const fetchImpl = async (u, init = {}) => {
    const res = await fetch(u, init);
    const text = init.method === "HEAD" ? "" : await res.text();
    record({
      method: init.method || "GET",
      requestHeaders: init.headers || {},
      body: init.body,
      status: res.status,
      responseHeaders: Object.fromEntries(res.headers.entries()),
      text,
    });
    return new Response(init.method === "HEAD" ? null : text, { status: res.status, headers: res.headers });
  };
  const load = loader(webapp, { window: win, fetch: fetchImpl, navigator: { onLine: true } });

  const ContextStub = { of: () => null };
  const Lib = load("core/Lib.js", { "z2ui5/core/Context": ContextStub });
  Lib.logError = (msg, e) => { errors.push(`${msg}${e ? `: ${e.message || e}` : ""}`); };
  const Device = {
    system: { desktop: true }, browser: { name: "cr", version: 140 }, os: { name: "linux", version: "" },
    support: { touch: false, pointer: true, retina: false }, orientation: { portrait: false, landscape: true },
    resize: { width: 1280, height: 800 },
  };
  const Session = load("core/Session.js", { "sap/ui/Device": Device, "z2ui5/core/Lib": Lib });
  const AppState = load("core/AppState.js", {});

  const errors = [];
  const responses = [];
  let settle = null;
  const mainController = {
    async _processAfterRendering() {
      responses.push(ctx.state.oResponse);
      ctx.state.isBusy = false;
      if (settle) settle(ctx.state.oResponse);
    },
  };
  const Server = load("core/Server.js", {
    "sap/ui/core/BusyIndicator": { show() {}, hide() {} },
    "sap/ui/VersionInfo": { load: async () => ({}) },
    "z2ui5/core/Lib": Lib,
    "z2ui5/core/Session": Session,
    "z2ui5/core/ScrollFocus": { getFocusInfo: () => undefined, getScrollInfo: () => undefined },
    "z2ui5/core/ViewSlots": { getController: () => mainController },
    "z2ui5/core/ErrorView": {
      show: (_c, response) => {
        errors.push(String(response && response.message ? response.message : response));
        if (settle) settle(null);
      },
      reset() {},
    },
  });

  const ctx = {
    component: null,
    alive: true,
    state: Object.assign(AppState.createState(), {
      url,
      oConfig: {
        S_UI5: { VERSION: "1.136.0", BUILDTIMESTAMP: "202509010000", GAV: "com.sap.openui5.dist:sdk:1.136.0", THEME: "sap_horizon" },
      },
    }),
    server: { requestSeq: 0, inflight: new Set(), viewBuild: null, csrfToken: "" },
    session: { configSent: false, liveSent: "", pending: null, locationSent: false },
  };

  const next = () => new Promise((resolve) => { settle = resolve; });

  return {
    ctx,
    errors,
    responses,
    /** The page load's first roundtrip (App.controller -> Server.roundtrip(ctx, {})). */
    async start() {
      const done = next();
      Server.roundtrip(ctx, {});
      return done;
    },
    /** What View1.eB does for a wire `.eB(['<event>'], ...args)` fired from the MAIN view,
     *  with `edits` ({ path: value }) typed into the MAIN model since the last roundtrip. */
    async fire(event, args = [], edits = {}) {
      const body = {};
      const data = JSON.parse(JSON.stringify(ctx.state.oResponse.OVIEWMODEL || {}));
      const paths = new Set(Object.keys(edits));
      for (const [p, v] of Object.entries(edits)) {
        const parts = p.slice(1).split("/");
        let node = data;
        for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]];
        node[parts[parts.length - 1]] = v;
      }
      if (paths.size) body.MODEL = Lib.buildDeltaFromPaths(paths, data);
      body.ID = ctx.state.oResponse.ID;
      body.ARGUMENTS = Lib.normalizeEventArgs([[event], ...args]);
      ctx.state.isBusy = true;
      const done = next();
      Server.roundtrip(ctx, body);
      return done;
    },
    /** A Back/Forward or bookmark restore: window.location.hash changes, then the empty-body roundtrip. */
    async restore(hash) {
      win.location.hash = hash;
      const done = next();
      Server.restoreFromRoute(ctx);
      return done;
    },
  };
}
