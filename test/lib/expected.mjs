// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.

/** Backend-suite checks the two reference backends fail today, by check id. */
export const BACKEND_EXPECTED_FAILURES = Object.freeze({
  // spec/errors.md, open question 3 (decided in revision 0.3): the request
  // URL is reflected verbatim into the first frame of the 500 body. Fixed in
  // abap2UI5 core ([H] request_context_info strips the URL to safe
  // characters, as app_start_safe does for the class name) and so in
  // cap2UI5, which hosts the same framework; both reference hosts run the
  // released @abap2ui5/node-runtime 1.146.0 until a release carries the fix.
  "error.no-reflection": "abap2UI5 [H] request_context_info - URL reflected verbatim (fix: strip it to safe characters)",
});

export const BACKEND_EXPECTED_FAILURE_IDS = Object.freeze(Object.keys(BACKEND_EXPECTED_FAILURES));
