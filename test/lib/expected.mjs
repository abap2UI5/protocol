// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.
import { appDrivenWindow } from "../../conformance/hosts/node-runtime/build.mjs";

/**
 * The checks of the windowed tables (spec/windowed-tables.md) describe the
 * app-driven window, which abap2UI5 merged to main with 694fb262 (#3032),
 * after the release 1.150.0. Both reference hosts pin released packages
 * without it - @abap2ui5/node-runtime 1.150.0, and @cap2ui5/cds-plugin
 * 0.7.0 (on the runtime 1.149.0) - and cannot start the app WINDOW: the node-runtime
 * host leaves it out of its build (conformance/hosts/node-runtime/build.mjs),
 * the plugin refuses its window_bind_tab( { total, event } ). Every window
 * check then ends on the app's start: the seven MUST checks fail, the SHOULD
 * `window.request-bounds` warns (conformance/RESULTS.md).
 */
const NODE_FIX = "abap2UI5 main 694fb262, the next release after 1.150.0: @abap2ui5/node-runtime with the app-driven window (window_bind_tab( val total event window )) - the host leaves the app WINDOW out of its build until then";
const CAP_FIX = "abap2UI5 main 694fb262, the next release after 1.150.0, hosted by cap2UI5: @cap2ui5/cds-plugin 0.7.0 hosts the runtime 1.149.0 and refuses window_bind_tab( { total, event } ), the app WINDOW does not start";
const MUST_IDS = ["window.first-window", "window.app-event", "window.request-sort-filter", "window.total-from-app",
  "window.order-with-the-draft", "window.delta-rows", "window.delta-rows-reference", "window.whole-table-written"];
const SHOULD_IDS = ["window.request-bounds"];
const pins = (list, fix) => Object.freeze(Object.fromEntries(list.map((id) => [id, fix])));
const WINDOW_MUST = pins(MUST_IDS, NODE_FIX);
const WINDOW_SHOULD = pins(SHOULD_IDS, NODE_FIX);
const CAP_WINDOW_MUST = pins(MUST_IDS, CAP_FIX);
const CAP_WINDOW_SHOULD = pins(SHOULD_IDS, CAP_FIX);
const DETAILS = "cap2UI5 answers a JavaScript app's exception with a correlation id and logs the text - by design";

/**
 * Whether the installed @abap2ui5/node-runtime has the app-driven window.
 * The released 1.150.0 (package.json, CI) has not; a runtime built from
 * abap2UI5 main 694fb262 or later (installed with npm install --no-save, as
 * the traffic in traffic/ was recorded) has, and passes every window check
 * - so the node-runtime pins follow what is installed, and stay exact for
 * both. The cap2UI5 host has no such switch: plugin 0.7.0 hosts 1.150.0.
 */
export const NODE_RUNTIME_APP_DRIVEN = appDrivenWindow();

/**
 * Backend-suite checks a reference backend fails today (a MUST), per backend
 * and by check id, in the order the suite runs them. Besides the windowed
 * tables none: `error.no-reflection` (the request URL reflected into the
 * 500 body, spec/errors.md, open question 3) was pinned for both until the
 * hosts ran a release with the fix (@abap2ui5/node-runtime 1.148.0,
 * @cap2ui5/cds-plugin 0.5.0); the thirteen checks of the window of 1.149.0
 * were pinned for cap2UI5 0.5.0 (runtime 1.147.0, no window_bind_tab( ));
 * the two checks of a table behind a data reference (spec/request.md, open
 * question 14) for cap2UI5 0.6.0, which could not declare a field
 * TYPE REF TO data - 0.7.0 brings t.ref( ) and passes `model.reference-delta`.
 */
export const BACKEND_EXPECTED_FAILURES = Object.freeze({
  "node-runtime": NODE_RUNTIME_APP_DRIVEN ? Object.freeze({}) : WINDOW_MUST,
  cap2ui5: CAP_WINDOW_MUST,
});

/**
 * SHOULD checks a reference backend does not meet (a warning), the same way.
 * `error.details`: cap2UI5 hides a JavaScript app's exception text
 * (conformance/RESULTS.md). `window.request-bounds`: the windowed tables, as
 * above.
 */
export const BACKEND_EXPECTED_WARNINGS = Object.freeze({
  "node-runtime": NODE_RUNTIME_APP_DRIVEN ? Object.freeze({}) : WINDOW_SHOULD,
  cap2ui5: Object.freeze({ ...CAP_WINDOW_SHOULD, "error.details": DETAILS }),
});

/**
 * What the recorded traffic (traffic/<backend>/suite.json) carries: it was
 * recorded with the node-runtime host on a runtime built from abap2UI5 main
 * 694fb262 - the app-driven window, every check passes - and with the
 * cap2UI5 host on plugin 0.7.0, which fails the window checks as above
 * (conformance/RESULTS.md, "What the traffic is recorded against").
 * test/traffic.test.mjs reads these, not the pins of what is installed.
 */
export const RECORDED_FAILURES = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: CAP_WINDOW_MUST,
});
export const RECORDED_WARNINGS = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({ ...CAP_WINDOW_SHOULD, "error.details": DETAILS }),
});

const ids = (pins, backend) => {
  if (!pins[backend]) throw new Error(`no pins for backend "${backend}" - node-runtime or cap2ui5`);
  return Object.freeze(Object.keys(pins[backend]));
};
/** The pinned failures of `backend` ("node-runtime" | "cap2ui5"), in suite order. */
export const expectedFailureIds = (backend) => ids(BACKEND_EXPECTED_FAILURES, backend);
/** The pinned warnings of `backend`, in suite order. */
export const expectedWarningIds = (backend) => ids(BACKEND_EXPECTED_WARNINGS, backend);
/** The failures and warnings the recorded traffic of `backend` carries. */
export const recordedFailureIds = (backend) => ids(RECORDED_FAILURES, backend);
export const recordedWarningIds = (backend) => ids(RECORDED_WARNINGS, backend);

/**
 * The checks whose recorded traffic cannot be compared between the two
 * backends because one of them never gets past the app's start: the
 * windowed tables, while the cap2UI5 host cannot start the app WINDOW (the
 * pins above). Every other check is answered identically by both
 * (test/traffic.test.mjs); the list empties with those pins. (The two of
 * the app REF were here while cap2UI5 0.6.0 could not start it.)
 */
export const BACKEND_TRAFFIC_APART = Object.freeze([...MUST_IDS, ...SHOULD_IDS]);
