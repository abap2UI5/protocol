// Shared scenario pieces of the frontend checks.
import { recorded, answer, display, mainView, button } from "../responses.mjs";

export const BIND = "Z2UI5_CL_CONF_BIND";
export const CHECK = { text: "Check", event: "CHECK" };
export const ADD_ROW = { text: "Add row", event: "ADD_ROW" };

/** Start the recorded BIND app (Input /NAME, StepInput /QTY, CheckBox /FLAG,
 *  /S_ADDR/CITY and ZIP, a table /T_ITEMS with editable TEXT and DONE).
 *  Resolves the first response body. */
export async function startBind(t) {
  const first = recorded("model.scalar", 0);
  t.mock.reply(first);
  await t.start(BIND);
  return first.body;
}

/** A synthetic app: a MAIN view with `body`, its model, and a fresh id. */
export function app(body, { model, app: cls = "Z2UI5_CL_CONF_FE", custom, title, page, ns } = {}) {
  return answer({ app: cls, system: [display("MAIN", mainView(body, { title, page, ns }))], model, custom });
}

/** Start a synthetic app. Resolves the response body. */
export async function startApp(t, body, opts = {}) {
  const r = app(body, opts);
  t.mock.reply(r);
  await t.start(opts.app || "Z2UI5_CL_CONF_FE");
  return r.body;
}

export const NEXT = { text: "Next", event: "NEXT" };
export const nextButton = button("Next", "NEXT");

/** The POSTs' S_FRONT.ID values in order. */
export const ids = (t) => t.posts().map((r) => {
  const j = r.json || {};
  const v = j.value || j;
  return v.S_FRONT ? v.S_FRONT.ID : undefined;
});

export const hasOwn = (o, k) => Boolean(o) && Object.prototype.hasOwnProperty.call(o, k);

/** The value at a model path on screen: a bound field's value when the
 *  adapter reports fields, else the slot's model. */
export function valueAt(state, p, slot = "MAIN") {
  if (state.values && Object.prototype.hasOwnProperty.call(state.values, p)) return state.values[p];
  let node = state.models && state.models[slot];
  for (const seg of p.split("/").filter(Boolean)) node = node == null ? undefined : node[seg];
  return node;
}
