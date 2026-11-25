/*
 * One response of protocol 3 folded into the state the renderers render
 * from: the views in their slots, the models, the follow-up actions.
 *
 * The state has the shape of the vendored snapshot module's (emptyState,
 * modelKeyOf, getAt and setAt read it, and so do renderers/common/view.mjs
 * and request.mjs). Its own fold (applyResponse) reads protocol 2 -
 * S_ACTION.T_SYSTEM and T_CUSTOM, and a teardown of POPUP and POPOVER when
 * the answering app changes - and the vendored copy is byte-equal to
 * abap2UI5/mcp-server, so the renderers fold with this module until that
 * client speaks protocol 3 (conformance/RESULTS.md).
 *
 *   - S_FRONT.VIEWS, in slot order - MAIN, NEST, NEST2, POPUP, POPOVER -
 *     whatever order its keys are in (spec/response.md#view-slots): an entry
 *     with DESTROY tears the slot down, one with XML displays the view. A
 *     MAIN display takes the nested views, the popup and the popover down
 *     first - the frontend's rule, the backend sends no teardown for it;
 *   - nothing is torn down because another APP answered: the teardown of an
 *     app hop is in VIEWS (the backend's rule);
 *   - a displayed slot gets its model from this response; a MODEL key is
 *     pushed into every open slot whose model belongs to the app that
 *     answered;
 *   - S_FRONT.ACTIONS is kept as the last response's client work, and a
 *     VIEW_SLOTS destroy in it is applied.
 * A response without MODEL leaves every model as it was.
 */
import { emptyState, modelKeyOf } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";

/** The slots, in the order their entries are applied. */
export const SLOTS = Object.freeze(["MAIN", "NEST", "NEST2", "POPUP", "POPOVER"]);
const MODEL_OWNING = ["MAIN", "POPUP", "POPOVER"];

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function drop(next, slot) {
  delete next.slots[slot];
  if (slot === "MAIN") {
    delete next.slots.NEST;
    delete next.slots.NEST2;
  }
  if (slot === "POPUP" || slot === "POPOVER") delete next.models[slot];
}

const copy = (prev) => ({ app: prev.app, id: prev.id, slots: { ...prev.slots }, models: { ...prev.models }, custom: prev.custom });

/** The state with `slot` torn down - what the wired close of a popup does
 *  (.eF('CONTROL_GLOBAL', 'VIEW_SLOTS', 'destroy', 'POPUP')), no roundtrip. */
export function destroySlot(state, slot) {
  const next = copy(state || emptyState());
  drop(next, slot);
  return next;
}

export function applyResponse(state, response) {
  const prev = state || emptyState();
  const next = { ...copy(prev), custom: [] };
  const front = (response && response.S_FRONT) || {};
  if (front.APP) next.app = front.APP;
  if (front.ID) next.id = front.ID;
  const hasModel = Boolean(response) && response.MODEL !== undefined;
  const data = hasModel ? response.MODEL : {};
  const views = isObject(front.VIEWS) ? front.VIEWS : {};
  const displayed = new Set();
  for (const slot of SLOTS) {
    const entry = views[slot];
    if (!isObject(entry)) continue;
    if (entry.DESTROY === true) {
      drop(next, slot);
    } else if (typeof entry.XML === "string") {
      if (slot === "MAIN") for (const s of ["MAIN", "POPUP", "POPOVER"]) drop(next, s);
      next.slots[slot] = { xml: entry.XML, app: next.app, options: isObject(entry.OPT) ? entry.OPT : {} };
      const key = modelKeyOf(slot);
      if (slot === key || !next.models[key]) {
        next.models[key] = { app: next.app, data: clone(data) || {} };
        displayed.add(key);
      }
    }
  }
  for (const a of Array.isArray(front.ACTIONS) ? front.ACTIONS : []) {
    if (!Array.isArray(a)) continue;
    const b = a[0] === "CONTROL_GLOBAL" ? a.slice(1) : a;
    if (b[0] === "VIEW_SLOTS" && b[1] === "destroy") {
      drop(next, b[2]);
      continue;
    }
    next.custom.push(a);
  }
  if (hasModel) {
    for (const key of MODEL_OWNING) {
      const m = next.models[key];
      if (!m || displayed.has(key)) continue;
      if (!m.app || m.app === next.app) next.models[key] = { app: m.app || next.app, data: clone(data) };
    }
  }
  return next;
}
