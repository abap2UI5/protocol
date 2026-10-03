/*
 * @abap2ui5/protocol/renderers/adaptive-cards - a prototype portable renderer:
 * abap2UI5 responses (view XML + model, portable profile v1) as Adaptive
 * Cards 1.5, and Action.Submit payloads back as protocol requests.
 * See README.md.
 *
 *   import { renderResponses, submitToRequest, createCardHost } from "@abap2ui5/protocol/renderers/adaptive-cards";
 *   const { card, unsupported, state } = renderResponses([response]);
 */
import { applyResponse, emptyState } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";
import { renderCard } from "./render.mjs";

export { renderCard, cardText, liveSlots, modelKeyOf, walk, htmlToText, CARD_SCHEMA, CARD_VERSION, LEAVE_EVENT } from "./render.mjs";
export { submitToRequest, eventRequest, startRequest, coerce } from "./submit.mjs";
export { createCardHost, PROTOCOL } from "./host.mjs";
export { CONTROLS, TOLERATED } from "./mapping.mjs";

/** Fold responses (in order, as a frontend adopts them) and render the
 *  card. Resolves { card, unsupported, state }. */
export function renderResponses(responses, options = {}) {
  let state = emptyState();
  for (const r of responses) state = applyResponse(state, r);
  return { ...renderCard(state, options), state };
}
