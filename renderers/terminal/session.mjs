/*
 * The terminal renderer's session with an abap2UI5 backend: the roundtrip
 * protocol over HTTP, the folded response state, the follow-up actions and
 * a hash history - everything of a frontend except the screen. Renderer
 * neutral: app.mjs drives it from keys, the conformance adapter through
 * app.mjs.
 *
 *   const s = createSession({ url: "https://host/sap/bc/z2ui5?sap-client=100", user, password });
 *   await s.start("Z2UI5_CL_MY_APP");
 *   s.edit("MAIN", "/NAME", "Ada");          // a two-way binding writes the model
 *   await s.fire({ event: "SAVE" });          // the edits travel as the delta
 *
 * The client rules of spec/transport.md#client-behaviour, as a browser
 * frontend follows them: Content-Type and sap-contextid-accept on every POST,
 * the last valid sap-contextid kept and sent back, the CSRF token handshake
 * (403 + X-CSRF-Token: Required -> HEAD with Fetch -> one re-send), no retry
 * of a 500, a timeout, one roundtrip at a time (a fire while one is in
 * flight is queued and its request built when it leaves - revision 0.3,
 * open question 8), the terminate HEAD when the session ends. For a real
 * SAP system: basic authentication, the cookies the system sets (the logon
 * ticket, SAP_SESSIONID) kept like a browser keeps them, and the query of
 * the URL (sap-client, sap-language) kept on every request.
 *
 * The model delta is the UI5 frontend's: the paths the user edited since
 * the last roundtrip of that model (spec/request.md#the-model-delta),
 * built by ../common/request.mjs. Edits made while a roundtrip is in flight
 * survive its model push and travel with the next event.
 *
 * Routing (spec/navigation.md#the-router-action): the session keeps the
 * hash a browser would show and a history of it, synchronised once per
 * response like the UI5 router (core/Router.js `sync`): KEEP / FRESH
 * routes, the caller's entry repointed on a nav_app_call, the app-state
 * hash, app-owned hash writes; every request carries the non-empty hash as
 * HASH; `back()` steps the history and restores the route it lands on with
 * an app-start-shaped request, as the browser's Back does.
 */
import { applyResponse, emptyState, getAt, setAt } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";
import { modelKeyOf, liveSlots, PROFILE } from "../common/view.mjs";
import { submitToRequest, startRequest, eventRequest } from "../common/request.mjs";

export const PROTOCOL = 2;

/** What a portable renderer receives as T_CUSTOM / .eF (portable-v1.json actions.wire). */
const WIRE = PROFILE.actions.wire;

const validContextId = (v) => typeof v === "string" && v.trim() !== "" && v !== "undefined" && v !== "null";

/** The app part of a hash, normalised: no `#`, no leading slashes. */
const appHash = (h) => String(h || "").replace(/^#/, "").replace(/^\/+/, "");
/** The hash as location.hash shows it after a HashChanger write. */
const fullHash = (h) => (appHash(h) ? `#/${appHash(h)}` : "");

/** `app/<CLASS>[/<DRAFT>]` -> { app, draft }; a namespaced class keeps its
 *  slashes (`app//NS/CL_X/<DRAFT>`, spec/navigation.md#routes). */
export function parseRoute(h) {
  const m = /^app\/(.+)$/.exec(appHash(h));
  if (!m) return null;
  let rest = m[1];
  let app;
  if (rest.startsWith("/")) {
    const ns = /^(\/[^/]+\/[^/]+)(?:\/(.*))?$/.exec(rest);
    if (!ns) return null;
    app = ns[1];
    rest = ns[2] || "";
  } else {
    const i = rest.indexOf("/");
    app = i < 0 ? rest : rest.slice(0, i);
    rest = i < 0 ? "" : rest.slice(i + 1);
  }
  return { app, draft: rest.split("/")[0] || "" };
}

const route = (app, draft) => `app/${app}${draft ? `/${draft}` : ""}`;

/** The cookies of a fetch response: name=value of every Set-Cookie. */
function setCookies(headers) {
  const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : (headers.get("set-cookie") ? [headers.get("set-cookie")] : []);
  return list.map((c) => /^\s*([^=;\s]+)=([^;]*)/.exec(c)).filter(Boolean).map((m) => [m[1], m[2]]);
}

export function createSession({
  url,
  user,
  password,
  cookie,
  headers: extraHeaders = {},
  location,
  fetchImpl = globalThis.fetch,
  timers = true,
  timeoutMs = 120_000,
  onChange = () => {},
} = {}) {
  if (!url) throw new Error("createSession: url is required");
  const u = new URL(url);
  // the query of the URL (sap-client, sap-language) stays on every start
  const where = location || ((app) => {
    const q = new URLSearchParams(u.search);
    if (app) q.set("app_start", app);
    const search = q.toString();
    return { origin: u.origin, pathname: u.pathname, search: search ? `?${search}` : "" };
  });

  let state = emptyState();
  let error = null;
  let messages = [];
  let title = null;
  let busyShown = false;
  let started = null; // the location of the app start, for restores and reloads
  const log = [];
  /** notices of the last roundtrip, for the status line */
  let notices = [];
  const effects = [];
  let focusRequest = null;
  let scrollRequest = null;
  /** per model key: path -> value, edited and not sent yet */
  const pending = { MAIN: new Map(), POPUP: new Map(), POPOVER: new Map() };
  let contextId = null;
  let csrf = null;
  const jar = new Map();
  if (cookie) for (const part of String(cookie).split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  const auth = user !== undefined && user !== null ? `Basic ${Buffer.from(`${user}:${password ?? ""}`).toString("base64")}` : null;
  let inflight = null;
  const queue = [];
  const armed = new Set();
  let stopped = false;
  let roundtrips = 0;

  // the hash history (a browser's, for this page)
  const router = { trail: [""], pos: 0, navRouting: false, navMode: null, currentApp: null, currentDraftId: null, navFromHash: false, hashEvent: null, appHash: "" };

  const note = (text) => {
    log.push(text);
    notices.push(text);
  };
  const changed = () => onChange(session);

  function baseHeaders() {
    const h = { ...extraHeaders };
    if (auth) h.authorization = auth;
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (contextId) h["sap-contextid"] = contextId;
    return h;
  }

  function remember(res) {
    for (const [k, v] of setCookies(res.headers)) jar.set(k, v);
  }

  async function post(body) {
    const text = JSON.stringify({ value: body });
    const signal = AbortSignal.timeout(timeoutMs);
    const send = () => {
      const h = { ...baseHeaders(), "content-type": "application/json", "sap-contextid-accept": "header" };
      if (csrf) h["x-csrf-token"] = csrf;
      return fetchImpl(url, { method: "POST", headers: h, body: text, signal });
    };
    let res = await send();
    remember(res);
    // a token layer's refusal: fetch a token, send the same body once more
    if (res.status === 403 && /^required$/i.test(res.headers.get("x-csrf-token") || "")) {
      await res.text();
      const head = await fetchImpl(url, { method: "HEAD", headers: { ...baseHeaders(), "x-csrf-token": "Fetch" }, signal });
      remember(head);
      const token = head.headers.get("x-csrf-token") || "";
      csrf = token && !/^(required|fetch)$/i.test(token) ? token : null;
      if (csrf) {
        res = await send();
        remember(res);
      }
    }
    const id = res.headers.get("sap-contextid");
    if (validContextId(id)) contextId = id;
    return { status: res.status, type: res.headers.get("content-type") || "", text: await res.text() };
  }

  // ---------------------------------------------------------- router ----

  function write(h, replace) {
    const v = fullHash(h);
    if (replace) {
      router.trail[router.pos] = v;
      return;
    }
    router.trail = router.trail.slice(0, router.pos + 1);
    router.trail.push(v);
    router.pos = router.trail.length - 1;
  }

  const hash = () => router.trail[router.pos];

  /** The ROUTER sync of one response ([RT] sync): the options when present,
   *  the response's ID either way. */
  function sync(opts, id, app) {
    if (opts.setNavRouting) {
      const mode = String(opts.setNavRouting).toUpperCase();
      const on = mode === "KEEP" || mode === "FRESH";
      router.navRouting = on;
      router.navMode = on ? mode : null;
    }
    if (opts.setHashEvent) {
      router.hashEvent = String(opts.setHashEvent).trim() || null;
      router.appHash = appHash(hash());
    }
    const appWrite = opts.setPushState || opts.setHashReplace;
    const push = Boolean(opts.setPushState);
    if (router.navRouting) {
      if (app) {
        const draft = router.navMode === "FRESH" ? null : id;
        router.currentApp = app;
        router.currentDraftId = draft;
        if (router.navFromHash) {
          // the history already stands on this entry - rewriting it would drop the forward entries
          router.navFromHash = false;
        } else if (!appWrite) {
          const r = route(app, draft);
          if (opts.checkNavAppCall) {
            // the caller's entry first points at the draft saved at the call
            if (draft && opts.navAppCallPrevApp && opts.navAppCallPrevId) write(route(opts.navAppCallPrevApp, opts.navAppCallPrevId), true);
            write(r, false);
          } else if (appHash(hash()) !== r) {
            write(r, true);
          }
        }
      }
      if (!appWrite) return;
      if (router.currentDraftId) {
        write(route(router.currentApp, router.currentDraftId) + appWrite, !push);
        return;
      }
    }
    if (appWrite) {
      if (router.hashEvent) router.appHash = appHash(appWrite);
      write(appWrite, !push);
      return;
    }
    if (router.hashEvent) return;
    write(opts.setAppStateActive ? `z2ui5-xapp-state=${id || ""}` : "", true);
  }

  /** The history moved to `h` (Back/Forward): restore the route it names,
   *  or raise the app's hash event. */
  function hashChanged(h) {
    if (!router.navRouting) {
      if (router.hashEvent && appHash(h) !== router.appHash) {
        router.appHash = appHash(h);
        return enqueue({ payload: { event: router.hashEvent }, timer: true });
      }
      return Promise.resolve(session);
    }
    const r = parseRoute(h);
    if (!r) return Promise.resolve(session);
    if (r.draft ? r.draft === router.currentDraftId : r.app.toUpperCase() === String(router.currentApp).toUpperCase()) return Promise.resolve(session);
    router.navFromHash = true;
    // an app-start-shaped request: no ID, the location and the new hash
    return enqueue({ start: { ...startRequest(started || where("")) } });
  }

  // ---------------------------------------------------------- adopt ----

  /** One response read and, when it is a valid one, adopted. */
  function adopt(r) {
    notices = [];
    if (r.status < 200 || r.status >= 300) {
      // the body is shown verbatim - it is text/plain, never markup (spec/errors.md)
      error = { text: r.text ? `HTTP ${r.status}\n${r.text}` : `HTTP ${r.status}` };
      return;
    }
    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      error = { text: `the backend answered no JSON (${r.type || "no content type"}): ${r.text.slice(0, 200)}` };
      return;
    }
    if (!json || typeof json !== "object" || !json.S_FRONT) {
      error = { text: `the backend answered without S_FRONT: ${r.text.slice(0, 200)}` };
      return;
    }
    const p = json.S_FRONT.PROTOCOL;
    if (p !== undefined && p !== null && Number(p) !== PROTOCOL) {
      error = { text: `the backend speaks protocol ${p}, this renderer protocol ${PROTOCOL} - nothing adopted` };
      return;
    }
    error = null;
    // a response of another app takes popup and popover down (spec/response.md#view-slots)
    if (json.S_FRONT.APP && state.app && json.S_FRONT.APP !== state.app) {
      state = { ...state, slots: { ...state.slots }, models: { ...state.models } };
      for (const s of ["POPUP", "POPOVER"]) {
        delete state.slots[s];
        delete state.models[s];
        pending[s].clear();
      }
    }
    state = applyResponse(state, json);
    roundtrips += 1;
    // edits not sent yet survive a model push
    for (const [key, map] of Object.entries(pending)) {
      const m = state.models[key];
      if (!m) {
        map.clear();
        continue;
      }
      for (const [path, v] of map) setAt(m.data, path, v);
    }
    messages = messages.filter((m) => m.kind === "box");
    const system = (json.S_FRONT.S_ACTION && json.S_FRONT.S_ACTION.T_SYSTEM) || [];
    const routerAction = system.find((a) => Array.isArray(a) && a[0] === "ROUTER");
    sync((routerAction && routerAction[2] && typeof routerAction[2] === "object") ? routerAction[2] : {}, json.S_FRONT.ID, json.S_FRONT.APP || state.app);
    for (const a of state.custom) followUp(a);
  }

  /** One follow-up action (spec/actions.md, profiles/portable.md section 6). */
  function followUp(raw) {
    const global = raw[0] === "CONTROL_GLOBAL";
    const a = global ? raw.slice(1) : raw;
    const [name, method, ...rest] = a;
    const o = (rest[1] && typeof rest[1] === "object") ? rest[1] : {};
    switch (name) {
      case "MESSAGE_TOAST":
        if (method !== "show") break;
        messages.push({ kind: "toast", text: String(rest[0] ?? "") });
        // a toast with onClose raises it when it closes ([CC] showToast) - after its duration
        if (o.onClose && timers) later(String(o.onClose), Number(o.duration) || 3000);
        return;
      case "MESSAGE_BOX":
        messages = messages.filter((m) => m.kind !== "box");
        messages.push({ kind: "box", type: method === "show" ? undefined : method, text: String(rest[0] ?? ""), title: o.title, details: o.details, actions: o.actions, onClose: o.onClose });
        return;
      case "START_TIMER":
        if (!timers) {
          log.push(`noop: START_TIMER ${method} (timers off)`);
          return;
        }
        later(String(method), Number(rest[0]) || 0);
        return;
      case "SET_FOCUS":
        focusRequest = String(method ?? "");
        return;
      case "SCROLL_TO":
      case "SCROLL_INTO_VIEW":
        scrollRequest = String(method ?? "");
        return;
      case "SET_TITLE":
        title = String(method ?? "");
        effects.push({ kind: "title", text: title });
        return;
      case "CLIPBOARD_COPY":
        effects.push({ kind: "clipboard", text: String(method ?? "") });
        note("copied to the clipboard");
        return;
      case "URLHELPER":
      case "OPEN_NEW_TAB": {
        const target = [method, ...rest].find((x) => typeof x === "string" && /^[a-z][\w+.-]*:/i.test(x)) || method;
        note(`open ${String(target ?? "")}`);
        return;
      }
      case "DOWNLOAD_B64_FILE":
        note(`download offered${rest[0] ? ` (${String(rest[0])})` : ""} - not saved by the terminal`);
        return;
      case "LOCATION_RELOAD":
        note("reload");
        session.reload().catch(() => {});
        return;
      case "HASH_BACK":
        session.back();
        return;
      case "BUSY_INDICATOR":
        busyShown = method === "show";
        return;
      case "INVISIBLE_MESSAGE":
        note(String(rest[0] ?? ""));
        return;
      default:
    }
    if (WIRE.custom.includes(name) || (WIRE.customGlobals[name] || []).includes(method)) {
      log.push(`noop: ${name}${global ? ` ${method}` : ""} - no counterpart in a terminal`);
      return;
    }
    const excluded = PROFILE.frontendActions.excluded.some((x) => x === name || x === `${raw[0]} ${name}`);
    note(`${excluded ? "outside the portable profile" : "unknown follow-up action"}: ${global ? `CONTROL_GLOBAL ${name}` : name} - skipped`);
  }

  /** An event raised by the frontend itself after `ms` (a timer, a toast
   *  closing) - an ordinary roundtrip, queued like any other. */
  function later(event, ms) {
    const t = setTimeout(() => {
      armed.delete(t);
      if (!stopped) enqueue({ payload: { event }, timer: true }).catch(() => {});
    }, ms);
    armed.add(t);
  }

  /** A frontend-only wire (.eF) or a follow-up run on the client: no roundtrip. */
  function client(action) {
    const a = action[0] === "CONTROL_GLOBAL" ? action.slice(1) : action;
    if (a[0] === "VIEW_SLOTS" && a[1] === "destroy") {
      state = applyResponse(state, { S_FRONT: { S_ACTION: { T_CUSTOM: [["VIEW_SLOTS", "destroy", a[2]]] } } });
      if (pending[a[2]]) pending[a[2]].clear();
      return;
    }
    followUp(action);
  }

  async function roundtrip(body) {
    // the non-empty hash goes with every request (spec/request.md#s_front)
    if (hash()) body.S_FRONT.HASH = hash();
    let r;
    try {
      r = await post(body);
    } catch (e) {
      notices = [];
      error = { text: `the backend did not answer: ${(e && e.message) || e}` };
      return;
    }
    adopt(r);
  }

  function buildDelta(key) {
    // a box close carries the edits made so far, like any event from that slot
    const m = state.models[key];
    if (!m || !pending[key].size) return {};
    const req = submitToRequest(state, { event: "_", ...(key !== "MAIN" ? { slot: key } : {}) }, { pending: [...pending[key].keys()] });
    pending[key].clear();
    return req.request.MODEL || {};
  }

  /** Run one queued job; the payload is built when it leaves. */
  async function run(job) {
    if (job.start) {
      await roundtrip(job.start);
      return;
    }
    const payload = typeof job.payload === "function" ? job.payload() : job.payload;
    if (!payload) return;
    const slot = payload.slot || "MAIN";
    const key = modelKeyOf(slot);
    // an action of a layer a modal one covers by now (queued before it opened) is dropped
    if (payload.box === undefined && !job.timer && !liveSlots(state, messages).includes(slot)) {
      log.push(`queued action ${payload.event || payload.client} dropped - its layer is no longer live`);
      return;
    }
    const r = submitToRequest(state, payload, { pending: [...pending[key].keys()] });
    // a press outside an open popover closes it first, as UI5 does
    if (slot === "MAIN" && state.slots.POPOVER && r.kind !== "box") client(["VIEW_SLOTS", "destroy", "POPOVER"]);
    if (r.kind === "client") {
      client(r.action);
      return;
    }
    if (r.kind === "box") {
      const box = messages.find((m) => m.kind === "box");
      messages = messages.filter((m) => m.kind !== "box");
      if (box && box.onClose) await roundtrip(eventRequest(state, String(box.onClose), [r.action], buildDelta("MAIN")));
      return;
    }
    // what is sent is no longer pending; what is typed meanwhile is
    pending[key].clear();
    await roundtrip(r.request);
  }

  function enqueue(job) {
    return new Promise((resolve, reject) => {
      queue.push({ ...job, resolve, reject });
      pump();
    });
  }

  async function pump() {
    if (inflight || !queue.length) return;
    const job = queue.shift();
    inflight = (async () => {
      try {
        await run(job);
        job.resolve(session);
      } catch (e) {
        job.reject(e);
      } finally {
        inflight = null;
        changed();
        pump();
      }
    })();
    changed();
  }

  const session = {
    get state() { return state; },
    get error() { return error; },
    get messages() { return messages.slice(); },
    get log() { return log.slice(); },
    get notices() { return notices.slice(); },
    get busy() { return Boolean(inflight) || queue.length > 0 || busyShown; },
    get contextId() { return contextId; },
    get hash() { return hash(); },
    get title() { return title; },
    get roundtrips() { return roundtrips; },
    get history() { return { entries: router.trail.slice(), position: router.pos }; },
    url,

    /** Start an app: the app-start request (no ID, ?app_start=<CLASS>). */
    start(app, { search } = {}) {
      const loc = where(app);
      started = { ...loc, ...(search !== undefined ? { search } : {}) };
      return enqueue({ start: startRequest(started) });
    },

    /** Start the app again from its location (and the hash). */
    reload() {
      return enqueue({ start: startRequest(started || where("")) });
    },

    /** A two-way binding writes `path` of the slot's model: the edit is
     *  shown at once and travels with the next event of that model. */
    edit(slot, path, value) {
      const key = modelKeyOf(slot);
      const m = state.models[key];
      if (!m) return;
      setAt(m.data, path, value);
      pending[key].set(path, getAt(m.data, path));
      changed();
    },

    /** The paths of `slot`'s model edited and not sent yet. */
    pendingPaths(slot = "MAIN") {
      return [...pending[modelKeyOf(slot)].keys()];
    },

    /** Fire an action: { event, args, refs, slot } (a roundtrip), { client }
     *  (no roundtrip) or { box } (a message box button) - or a function
     *  building it when it leaves the queue. Resolves when it is done. */
    fire(payload) {
      return enqueue({ payload });
    },

    /** Browser Back: one step back in the hash history. Resolves false when
     *  there is nothing to go back to. */
    back() {
      if (router.pos === 0) return Promise.resolve(false);
      router.pos -= 1;
      return hashChanged(router.trail[router.pos]).then(() => true);
    },

    /** Browser Forward. */
    forward() {
      if (router.pos >= router.trail.length - 1) return Promise.resolve(false);
      router.pos += 1;
      return hashChanged(router.trail[router.pos]).then(() => true);
    },

    /** The SET_FOCUS / SCROLL_TO target of the last response, once. */
    takeFocusRequest() {
      const f = focusRequest;
      focusRequest = null;
      return f;
    },
    takeScrollRequest() {
      const f = scrollRequest;
      scrollRequest = null;
      return f;
    },
    /** Effects for the terminal (title, clipboard), once. */
    takeEffects() {
      return effects.splice(0);
    },

    /** Resolves once nothing is in flight or queued. */
    async settle() {
      while (inflight || queue.length) await (inflight || Promise.resolve());
    },

    /** Stop the timers; later timer events are dropped. */
    stop() {
      stopped = true;
      for (const t of armed) clearTimeout(t);
      armed.clear();
    },

    /** End the session: the timers, and the stateful session on the server
     *  (the terminate HEAD, spec/transport.md#head-session-terminate-and-token-fetch). */
    async terminate() {
      session.stop();
      if (!contextId) return;
      try {
        await fetchImpl(url, { method: "HEAD", headers: { ...baseHeaders(), "sap-terminate": "session" }, signal: AbortSignal.timeout(5000) });
      } catch {
        // the session times out on the server anyway
      }
    },
  };
  return session;
}

