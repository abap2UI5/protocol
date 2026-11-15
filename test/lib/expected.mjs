// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.

/**
 * Backend-suite checks the two reference backends fail today, by check id -
 * none: `error.no-reflection` (the request URL reflected into the 500 body,
 * spec/errors.md, open question 3) was pinned here until the reference
 * hosts ran a release with the fix; abap2UI5 1.147.0 strips the URL ([H]
 * context_info_url_safe), and both hosts pass since @abap2ui5/node-runtime
 * 1.148.0 and @cap2ui5/cds-plugin 0.5.0.
 */
export const BACKEND_EXPECTED_FAILURES = Object.freeze({});

export const BACKEND_EXPECTED_FAILURE_IDS = Object.freeze(Object.keys(BACKEND_EXPECTED_FAILURES));
