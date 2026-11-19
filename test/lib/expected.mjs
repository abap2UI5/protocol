// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.

/**
 * Backend-suite checks a reference backend fails today (a MUST), per backend
 * and by check id, in the order the suite runs them. node-runtime: none -
 * `error.no-reflection` (the request URL reflected into the 500 body,
 * spec/errors.md, open question 3) was pinned for both until the hosts ran a
 * release with the fix; abap2UI5 1.147.0 strips the URL ([H]
 * context_info_url_safe), and both pass since @abap2ui5/node-runtime 1.148.0
 * and @cap2ui5/cds-plugin 0.5.0. cap2ui5: none either - the thirteen checks
 * of the windowed tables (spec/windowed-tables.md) were pinned for it while
 * its host ran @cap2ui5/cds-plugin 0.5.0, whose runtime (1.147.0) has no
 * window_bind_tab( ); the host runs 0.6.0 on the runtime 1.149.0 now and
 * passes them. Pinned for cap2ui5 today: the two checks of a table behind a
 * data reference (spec/request.md, open question 14) - a JavaScript app of
 * @cap2ui5/cds-plugin 0.6.0 cannot declare a field TYPE REF TO data, so the
 * twin of Z2UI5_CL_CONF_REF fails its start; the plugin's t.ref( ) after
 * 0.6.0 (cap2UI5/cap2UI5) is the fix.
 */
const NO_REF = "@cap2ui5/cds-plugin 0.6.0 has no t.ref( ) - the twin of Z2UI5_CL_CONF_REF fails its start; fixed by t.ref( ) in cap2UI5/cap2UI5 after 0.6.0";
export const BACKEND_EXPECTED_FAILURES = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({
    "model.reference-delta": NO_REF,
    "window.delta-positions-reference": NO_REF,
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
 * backends because one of them never gets past the app's start: the two of
 * the app REF, which cap2UI5 0.6.0 cannot start (above). Every other check
 * is answered identically by both (test/traffic.test.mjs); a pin that keeps
 * a host out of an app goes here.
 */
export const BACKEND_TRAFFIC_APART = Object.freeze(["model.reference-delta", "window.delta-positions-reference"]);
