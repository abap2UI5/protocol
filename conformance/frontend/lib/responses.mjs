/*
 * What the scripted backend answers with: recorded responses of a real
 * backend (traffic/node-runtime/suite.json, recorded by
 * scripts/record-traffic.mjs - the conformance apps on
 * @abap2ui5/node-runtime) and synthetic ones for the edge cases no real
 * backend sends on purpose (another PROTOCOL, an unknown follow-up action,
 * a CSRF layer, ...).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const TRAFFIC_FILE = path.join(ROOT, "traffic/node-runtime/suite.json");

let suiteCache = null;
function suite() {
  if (!suiteCache) suiteCache = JSON.parse(fs.readFileSync(TRAFFIC_FILE, "utf8"));
  return suiteCache;
}

/**
 * A recorded exchange's response as a mock reply: the backend-suite check
 * `checkId`, the `n`-th exchange (0-based) or the one labelled `label`.
 * Status, content type and body as the real backend answered.
 */
export function recorded(checkId, which = 0) {
  const c = suite().checks.find((x) => x.id === checkId);
  if (!c) throw new Error(`no recorded check ${checkId} in ${path.relative(ROOT, TRAFFIC_FILE)}`);
  const x = typeof which === "number" ? c.exchanges[which] : c.exchanges.find((e) => e.label === which);
  if (!x) throw new Error(`no exchange ${which} in recorded check ${checkId}`);
  const headers = {};
  if (x.response.headers["content-type"]) headers["content-type"] = x.response.headers["content-type"];
  return { status: x.response.status, headers, body: structuredClone(x.response.body), recorded: `${checkId} #${typeof which === "number" ? which : which}` };
}

let ui5Cache = null;
/** The response of the exchange labelled `label` in
 *  traffic/node-runtime/ui5-frontend.json - what the backend answered the
 *  UI5 frontend's own request code (scripts/lib/ui5-frontend.mjs). */
export function recordedUi5(label) {
  if (!ui5Cache) ui5Cache = JSON.parse(fs.readFileSync(path.join(ROOT, "traffic/node-runtime/ui5-frontend.json"), "utf8"));
  const x = ui5Cache.exchanges.find((e) => e.label === label);
  if (!x) throw new Error(`no exchange "${label}" in traffic/node-runtime/ui5-frontend.json`);
  return { status: x.response.status, headers: {}, body: structuredClone(x.response.body), recorded: `ui5-frontend ${label}` };
}

/** A fresh opaque draft id (32 upper-case hex, as the reference mints them). */
export const draftId = () => crypto.randomBytes(16).toString("hex").toUpperCase();

/** A synthetic 200 response. */
export function answer({ app = "Z2UI5_CL_CONF_FE", id = draftId(), protocol = 2, system, custom, model, sFront = {}, extra = {} } = {}) {
  const front = { ID: id, APP: app };
  if (protocol !== undefined) front.PROTOCOL = protocol;
  const action = {};
  if (system && system.length) action.T_SYSTEM = system;
  if (custom && custom.length) action.T_CUSTOM = custom;
  if (Object.keys(action).length) front.S_ACTION = action;
  Object.assign(front, sFront);
  const body = { S_FRONT: front, ...extra };
  if (model !== undefined) body.MODEL = model;
  return { status: 200, body };
}

export const display = (slot, xml, options) => (options ? ["VIEW_SLOTS", "display", slot, xml, options] : ["VIEW_SLOTS", "display", slot, xml]);
export const destroy = (slot) => ["VIEW_SLOTS", "destroy", slot];
export const router = (options) => ["ROUTER", "sync", options];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export const attr = esc;

/** A MAIN view: a Page with `body` inside. */
export const mainView = (body, { title = "conformance - frontend", ns = "", page = "" } = {}) =>
  `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc"${ns}><Page title="${esc(title)}"${page}>${body}</Page></mvc:View>`;

/** A NEST view (no Page). */
export const nestView = (body) => `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">${body}</mvc:View>`;

/** A POPUP document: a Dialog. */
export const popupView = (body, { title = "conformance popup", buttons = "" } = {}) =>
  `<core:FragmentDefinition xmlns="sap.m" xmlns:core="sap.ui.core"><Dialog title="${esc(title)}">${body}${buttons ? `<buttons>${buttons}</buttons>` : ""}</Dialog></core:FragmentDefinition>`;

/** A POPOVER document. */
export const popoverView = (body, { title = "conformance popover" } = {}) =>
  `<core:FragmentDefinition xmlns="sap.m" xmlns:core="sap.ui.core"><Popover title="${esc(title)}">${body}</Popover></core:FragmentDefinition>`;

/** A Button wired to backend event `event` with literal string arguments. */
export const button = (text, event, args = [], { id } = {}) => {
  const a = args.map((x) => (typeof x === "string" && !x.startsWith("$") ? `'${x.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'` : String(x)));
  return `<Button${id ? ` id="${id}"` : ""} text="${esc(text)}" press="${esc(`.eB(['${event}']${a.length ? `, ${a.join(", ")}` : ""})`)}"/>`;
};

/** A 5xx/4xx text answer. */
export const errorReply = (status, text, headers = {}) => ({ status, headers: { "content-type": "text/plain; charset=UTF-8", "x-content-type-options": "nosniff", ...headers }, body: text });
