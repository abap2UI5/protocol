// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.

// The cap2UI5 host stays on @cap2ui5/cds-plugin 0.5.0, the newest release,
// which hosts @abap2ui5/node-runtime 1.147.0: that runtime has no windowed
// tables (window_bind_tab( ) came with abap2UI5 1.149.0), the plugin's client
// has no such method, and the start of the conformance app WINDOW ends in a
// 500. Every check of spec/windowed-tables.md fails there on its first
// request. The fix is a plugin release on a runtime from 1.149.0 on - cap2UI5
// main has the two methods since its 0f8d821 (#111), and the twin app passes
// all thirteen checks there (conformance/RESULTS.md).
const CAP_NO_WINDOW = "@cap2ui5/cds-plugin 0.5.0 hosts @abap2ui5/node-runtime 1.147.0, which has no windowed tables - fixed by a plugin release on a runtime from 1.149.0 on";

/**
 * Backend-suite checks a reference backend fails today (a MUST), per backend
 * and by check id, in the order the suite runs them. node-runtime: none -
 * `error.no-reflection` (the request URL reflected into the 500 body,
 * spec/errors.md, open question 3) was pinned for both until the hosts ran a
 * release with the fix; abap2UI5 1.147.0 strips the URL ([H]
 * context_info_url_safe), and both pass since @abap2ui5/node-runtime 1.148.0
 * and @cap2ui5/cds-plugin 0.5.0.
 */
export const BACKEND_EXPECTED_FAILURES = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({
    "window.first-window": CAP_NO_WINDOW,
    "window.more-rows": CAP_NO_WINDOW,
    "window.sort": CAP_NO_WINDOW,
    "window.filter": CAP_NO_WINDOW,
    "window.growth-keeps-order": CAP_NO_WINDOW,
    "window.parts-kept-and-cleared": CAP_NO_WINDOW,
    "window.filters-anded": CAP_NO_WINDOW,
    "window.sort-last-set": CAP_NO_WINDOW,
    "window.order-with-the-draft": CAP_NO_WINDOW,
    "window.delta-positions": CAP_NO_WINDOW,
    "window.whole-table-refused": CAP_NO_WINDOW,
  }),
});

/**
 * SHOULD checks a reference backend does not meet (a warning), the same way.
 * `error.details`: cap2UI5 hides a JavaScript app's exception text
 * (conformance/RESULTS.md).
 */
export const BACKEND_EXPECTED_WARNINGS = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({
    "window.count-bounds": CAP_NO_WINDOW,
    "window.unknown-path-ignored": CAP_NO_WINDOW,
    "error.details": "cap2UI5 answers a JavaScript app's exception with a correlation id and logs the text - by design",
  }),
});

const ids = (pins, backend) => {
  if (!pins[backend]) throw new Error(`no pins for backend "${backend}" - node-runtime or cap2ui5`);
  return Object.freeze(Object.keys(pins[backend]));
};
/** The pinned failures of `backend` ("node-runtime" | "cap2ui5"), in suite order. */
export const expectedFailureIds = (backend) => ids(BACKEND_EXPECTED_FAILURES, backend);
/** The pinned warnings of `backend`, in suite order. */
export const expectedWarningIds = (backend) => ids(BACKEND_EXPECTED_WARNINGS, backend);

/**
 * The checks whose recorded traffic cannot be compared between the two
 * backends, because one of them never gets past the app's start: the
 * windowed tables on the cap2UI5 host (above). Every other check is answered
 * identically by both (test/traffic.test.mjs).
 */
export const BACKEND_TRAFFIC_APART = Object.freeze(
  [...Object.entries(BACKEND_EXPECTED_FAILURES.cap2ui5), ...Object.entries(BACKEND_EXPECTED_WARNINGS.cap2ui5)]
    .filter(([, why]) => why === CAP_NO_WINDOW).map(([id]) => id),
);
