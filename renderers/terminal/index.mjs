/*
 * @abap2ui5/protocol/renderers/terminal - a portable renderer for the
 * terminal: abap2UI5 responses (view XML + model, portable profile v1) as
 * a keyboard-driven text screen, and the keys back as protocol requests.
 * See README.md.
 *
 *   import { createSession, createTerminalApp, runTui, printResponses } from "@abap2ui5/protocol/renderers/terminal";
 *   const session = createSession({ url: "http://localhost:3000/" });
 *   const app = createTerminalApp({ session, width: 80, height: 24 });
 *   await session.start("Z2UI5_CL_MY_APP");
 *   await app.key("tab"); await app.type("Ada"); await app.key("enter");
 */
import { applyResponse, emptyState } from "../../conformance/frontend/adapters/vendor/mcp-server/snapshot.mjs";
import { renderScreen } from "./render.mjs";
import { createTerminalApp } from "./app.mjs";

export { renderScreen, renderNode, renderList } from "./render.mjs";
export { layoutBlocks, frame, flow, fitColumns, widgetLines } from "./layout.mjs";
export { createSession, parseRoute, PROTOCOL } from "./session.mjs";
export { createTerminalApp } from "./app.mjs";
export { runTui, keyName } from "./tty.mjs";
export { CONTROLS, ICON_TEXT, iconText } from "./mapping.mjs";
export { clean, strWidth, wrap, truncate, colorWanted, unicodeWanted, GLYPHS } from "./text.mjs";

/** A session that only holds folded responses: no backend, nothing fired. */
export function staticSession(state, { messages = [], error = null } = {}) {
  const none = () => Promise.resolve(false);
  return {
    state, error, messages, log: [], notices: [], busy: false, hash: "", title: null, roundtrips: 0,
    edit() {}, fire: none, back: none, forward: none, reload: none, start: none,
    takeFocusRequest: () => null, takeScrollRequest: () => null, takeEffects: () => [],
    settle: () => Promise.resolve(), stop() {}, terminate: () => Promise.resolve(),
  };
}

/** Fold responses (in order, as a frontend adopts them) and print the
 *  screen as text - the `--print` view of recorded traffic. Resolves
 *  { text, unsupported, state }. */
export function printResponses(responses, { width = 80, color = false, unicode = false, messages = [], error = null } = {}) {
  let state = emptyState();
  for (const r of responses) state = applyResponse(state, r);
  const app = createTerminalApp({ session: staticSession(state, { messages, error }), width, color, unicode });
  return { text: app.print(), unsupported: renderScreen(state, { messages, error }).unsupported, state };
}
