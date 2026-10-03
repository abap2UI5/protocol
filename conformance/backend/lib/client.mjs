/*
 * The frontend half of the conversation, as small as the protocol allows:
 * what core/Server.js of the UI5 frontend sends (spec/request.md), and the
 * response read back without rendering anything (spec/response.md).
 *
 * Every exchange is recorded (`exchanges`), so the runner can validate each
 * 2xx response against schema/response.schema.json and a failing check can
 * show the traffic it saw.
 */

/** Headers the UI5 frontend sends with every roundtrip (core/Server.js _post). */
export const ROUNDTRIP_HEADERS = Object.freeze({
  "content-type": "application/json",
  "sap-contextid-accept": "header",
});

export class ProtocolClient {
  /**
   * @param {object} o
   * @param {string} o.url        the roundtrip endpoint (what the page's GET URL is)
   * @param {Record<string,string>} [o.headers]  extra headers on every request (auth, ...)
   * @param {typeof fetch} [o.fetch]
   * @param {number} [o.timeoutMs]
   */
  constructor({ url, headers = {}, fetch: fetchImpl = globalThis.fetch, timeoutMs = 60_000 } = {}) {
    if (!url) throw new Error("ProtocolClient: url is required");
    this.url = url;
    this.extraHeaders = headers;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.exchanges = [];
    const u = new URL(url);
    this.origin = u.origin;
    this.pathname = u.pathname;
  }

  /** One HTTP request; resolves { status, headers, text, json }. */
  async raw({ method = "POST", body, headers = {}, label = "" } = {}) {
    const h = { ...this.extraHeaders, ...headers };
    const init = { method, headers: h, signal: AbortSignal.timeout(this.timeoutMs) };
    if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
    const res = await this.fetch(this.url, init);
    const text = method === "HEAD" ? "" : await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    const out = {
      status: res.status,
      headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
      text,
      json,
    };
    this.exchanges.push({ label, method, request: body, requestHeaders: h, response: out });
    return out;
  }

  /** A roundtrip POST of `payload`, wrapped in the { value } envelope as the frontend sends it. */
  post(payload, { envelope = true, headers = {}, label = "" } = {}) {
    return this.raw({
      method: "POST",
      body: envelope ? { value: payload } : payload,
      headers: { ...ROUNDTRIP_HEADERS, ...headers },
      label,
    });
  }

  /** The location fields of an app-start-shaped request (core/Session.js location). */
  location({ search = "", hash } = {}) {
    const s = { ORIGIN: this.origin, PATHNAME: this.pathname };
    if (search) s.SEARCH = search;
    if (hash) s.HASH = hash;
    return s;
  }

  /** App start: no ID, ?app_start=<app> in SEARCH (or a route in HASH). */
  start(app, { hash, search, label } = {}) {
    const s = search !== undefined ? search : (app ? `?app_start=${app}` : "");
    return this.post({ S_FRONT: this.location({ search: s, hash }) }, { label: label || `start ${app || hash || ""}` });
  }

  /** An event roundtrip continuing draft `id`. */
  event(id, event, { args, model, label } = {}) {
    const front = { ID: id, EVENT: event };
    if (args && args.length) front.T_EVENT_ARG = args;
    const payload = { S_FRONT: front };
    if (model) payload.MODEL = model;
    return this.post(payload, { label: label || `event ${event}` });
  }
}

// ------------------------------------------------------------ reading ----

export const sFront = (r) => (r && r.json && r.json.S_FRONT) || {};
export const systemActions = (r) => (sFront(r).S_ACTION && sFront(r).S_ACTION.T_SYSTEM) || [];
export const customActions = (r) => (sFront(r).S_ACTION && sFront(r).S_ACTION.T_CUSTOM) || [];

/** The VIEW_SLOTS display actions of a response, in order. */
export const displays = (r) => systemActions(r).filter((a) => Array.isArray(a) && a[0] === "VIEW_SLOTS" && a[1] === "display");
/** The display of `slot`, or undefined. */
export const displayOf = (r, slot) => displays(r).find((a) => a[2] === slot);
/** Whether the response tears `slot` down. */
export const destroys = (r, slot) => systemActions(r).some((a) => Array.isArray(a) && a[0] === "VIEW_SLOTS" && a[1] === "destroy" && a[2] === slot);
/** The ROUTER/sync options of a response, or undefined. */
export const routerOptions = (r) => {
  const a = systemActions(r).find((x) => Array.isArray(x) && x[0] === "ROUTER" && x[1] === "sync");
  return a ? a[2] : undefined;
};
export const hasModel = (r) => Boolean(r && r.json && Object.prototype.hasOwnProperty.call(r.json, "MODEL"));
export const model = (r) => (r && r.json && r.json.MODEL) || undefined;
