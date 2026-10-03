/*
 * The adapter contract of the frontend suite. A frontend is plugged in by an
 * object with this shape (see conformance/frontend/README.md):
 *
 *   name, description        for the report
 *   profiles                 the view profiles it claims: core, portable, ui5, semantic
 *   capabilities             a Set of what it can do beyond the core (below)
 *   open({ mock })           once per suite run: launch what it needs
 *   start(run, { app, search, hash })
 *                            a FRESH frontend instance against run.url, started
 *                            the way that frontend starts an app; resolves once
 *                            the first answer is processed (or failed)
 *   fill(target, value)      the user edits a field: target { path, id, slot }
 *   press(target)            the user fires an event: target { text, event, id, slot, nav }
 *   closeBox(action)         the user closes the open message box with `action`
 *   back()                   browser Back (capability "url")
 *   setModel(path, value, slot)  a two-way binding writes `path` (capability "modelEdit")
 *   settle()                 resolves once the frontend is idle
 *   state()                  the normalized state (below)
 *   stop()                   end the instance (close the page)
 *   close()                  end the run
 *
 * An interaction the frontend cannot perform throws Unsupported - the check
 * is then skipped with that reason, not failed.
 *
 * Capabilities: dom (a rendered DOM: visible text, markup probes), url (a
 * browser URL: routes, Back), timers (runs START_TIMER), focus (SET_FOCUS
 * observable), concurrent (an interaction can start while a roundtrip is in
 * flight), modelEdit, boxClose, nest (renders NEST/NEST2), snapshot
 * (semantic snapshots), title (document title), wires (UI5-profile wire
 * forms beyond .eB: .eBP, queue-last, .eF).
 *
 * The normalized state:
 *   { started, app, id,                     last adopted APP / S_FRONT.ID
 *     slots: { MAIN|NEST|NEST2|POPUP|POPOVER: { open, text } },
 *     values: { "<path>": value },          bound field values on screen
 *     models: { MAIN|POPUP|POPOVER: data }, when the frontend exposes them
 *     messages: [{ kind: "toast"|"box", text, type? }],
 *     error: null | { text },               the error the frontend shows
 *     log: [string],                        diagnostics (unknown actions, ...)
 *     hash, title, focus, text, xss, snapshot }
 */
export class Unsupported extends Error {
  constructor(message) {
    super(message);
    this.name = "Unsupported";
  }
}

export const emptyState = () => ({
  started: false,
  app: null,
  id: null,
  slots: Object.fromEntries(["MAIN", "NEST", "NEST2", "POPUP", "POPOVER"].map((k) => [k, { open: false, text: "" }])),
  values: {},
  models: {},
  messages: [],
  error: null,
  log: [],
  text: "",
  xss: false,
});

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
