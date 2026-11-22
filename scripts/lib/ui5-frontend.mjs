/*
 * The UI5 frontend's own request code, run in Node against a live backend:
 * bundle/webapp/core/Server.js (app/webapp up to 1.149.0), core/Session.js and core/Lib.js of an abap2UI5
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
  for (const dir of [path.join(home, "bundle", "webapp"), path.join(home, "app", "webapp")]) {
    if (fs.existsSync(path.join(dir, "core", "Server.js"))) return dir;
  }
  return null;
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
    // from abap2UI5 1.149.0 on; no scenario here queues an event offline
    "z2ui5/core/Offline": { reset() {}, canQueue: () => false },
    "z2ui5/core/Router": { dispatchPendingAppHash() {} },
  });

  // core/WindowModel.js (from abap2UI5 1.149.0 on): the list binding of a
  // windowed table, on stand-ins for the two UI5 classes it extends - a
  // JSONListBinding that holds the rows at its path and nothing else. What
  // the binding sends when it is asked for rows past the ones it holds, or
  // told to sort or to filter, is the shipped code's.
  const hasWindowModel = fs.existsSync(path.join(webapp, "core", "WindowModel.js"));
  const extend = (Base) => (_name, proto) => {
    const Class = Object.prototype.hasOwnProperty.call(proto, "constructor") ? proto.constructor : function Sub(...a) { Base.apply(this, a); };
    Class.prototype = Object.assign(Object.create(Base.prototype), proto, { constructor: Class });
    return Class;
  };
  function JSONListBinding(oModel, sPath) {
    this.oModel = oModel;
    this.sPath = sPath;
  }
  // the rows at its path in the model as it is now - UI5's binding
  // refreshes them in update( ), which every model push calls
  Object.defineProperty(JSONListBinding.prototype, "aIndices", {
    get() { return (this.oModel.getProperty(this.sPath) || []).map((_row, i) => i); },
  });
  Object.assign(JSONListBinding.prototype, { getContexts() { return []; }, getLength() { return this.aIndices.length; }, update() {}, sort() { return this; }, filter() { return this; }, applyFilter() {}, applySort() {} });
  JSONListBinding.extend = extend(JSONListBinding);
  function JSONModel() {}
  JSONModel.prototype.bindList = function bindList(oModel, sPath) { return new JSONListBinding(this, sPath); };
  JSONModel.extend = extend(JSONModel);
  const WindowModel = hasWindowModel ? load("core/WindowModel.js", {
    "sap/ui/model/json/JSONModel": JSONModel,
    "sap/ui/model/json/JSONListBinding": JSONListBinding,
    "z2ui5/core/Lib": Lib,
    "z2ui5/core/Env": { ownClass: (Class) => Class },
  }) : null;

  const ctx = {
    component: null,
    alive: true,
    state: Object.assign(AppState.createState(), {
      url,
      // the backend's own page: the component fills it and owns the hash
      // (Component.js ownsPage, ownsHash before it) - core/Server.js sends
      // S_FRONT.HASH only then
      ownsPage: true,
      ownsHash: true,
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
      body.ARGUMENTS = Lib.normalizeEventArgs([Array.isArray(event) ? event : [event], ...args]);
      ctx.state.isBusy = true;
      const done = next();
      Server.roundtrip(ctx, body);
      return done;
    },
    /** The list binding of the windowed table at `listPath` over the model of the last
     *  response (core/WindowModel.js), or null when this frontend has no windowed tables.
     *  Each window request it makes is sent the way actions/Slots.js sends it - the MAIN
     *  controller's eB([EVENT, false, false, false, true, noBusy], ...args) - and collected
     *  in `sent` as { args, response }; `idle()` resolves once every one was answered. */
    windowBinding(listPath) {
      if (!WindowModel) return null;
      const model = new WindowModel();
      const node = (p) => p.split("/").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), ctx.state.oResponse.OVIEWMODEL || {});
      model.getProperty = node;
      const sent = [];
      let chain = Promise.resolve();
      model._z2ui5WindowSend = (args, noBusy) => {
        const entry = { args: JSON.parse(JSON.stringify(args)) };
        sent.push(entry);
        chain = chain.then(async () => {
          entry.response = await this.fire([WindowModel.EVENT, false, false, false, true, Boolean(noBusy)], args);
          // the model push: UI5 updates every binding of the model
          binding.update();
        });
      };
      const binding = model.bindList(listPath);
      return { binding, sent, idle: () => chain, event: WindowModel.EVENT };
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
