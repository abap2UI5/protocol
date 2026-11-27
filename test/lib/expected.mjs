// Results of the reference implementations that are known to be wrong and
// pinned as such, each with the place the fix is made. A pin is exact: the
// tests fail when a pinned check starts to pass (unpin it then, and record
// the traffic again) as well as when another check fails.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appDrivenWindow, runtimeProtocol } from "../../conformance/hosts/node-runtime/build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The protocol number this revision specifies (spec/versioning.md). */
export const PROTOCOL = 3;

/**
 * Protocol 3 is released with abap2UI5 1.151.0; 1.150.0 and older speak
 * protocol 2. An implementation that still speaks protocol 2 is BEHIND: the
 * suites of this revision do not measure it - every exchange would fail on
 * the shape of the response - and say so with one check, which is pinned
 * as its one
 * failure: `response.protocol` for a backend (S_FRONT.PROTOCOL is not 3),
 * `slots.main` for a frontend (it refuses the response, or reads no view
 * out of it). The pin follows what is installed, like the one of the
 * app-driven window below: with an implementation on protocol 3 the full
 * suite runs and the pins further down apply.
 *
 *   node-runtime  @abap2ui5/node-runtime 1.151.0 (package.json, CI) speaks
 *                 protocol 3, and so does a runtime packed from abap2UI5
 *                 main (npm run pack:node-runtime there, npm install
 *                 --no-save here - as abap2UI5's own CI runs this suite);
 *                 1.150.0 and older speak 2
 *   cap2ui5       @cap2ui5/cds-plugin 0.8.0 hosts the runtime 1.151.0 and
 *                 speaks 3; 0.7.0 hosted 1.149.0 and spoke 2
 *   agent         the agent client of abap2UI5/mcp-server, vendored at
 *                 8a1d7d8 (main), speaks protocol 3 (PROTOCOL in
 *                 appclient.mjs) - upstream reads it from 7906a2f on; the
 *                 copy vendored before, 332a0b0, spoke 2
 *   ui5           the abap2UI5 checkout the frontend job uses (1.151.0 in
 *                 CI: protocol 3) - core/Server.js PROTOCOL; a checkout of
 *                 1.150.0 or older is behind
 */
const CAP_HOST = path.join(ROOT, "conformance/hosts/cap2ui5");
const CAP_PLUGIN = path.join(CAP_HOST, "node_modules/@cap2ui5/cds-plugin/package.json");
const VENDORED_CLIENT = path.join(ROOT, "conformance/frontend/adapters/vendor/mcp-server/appclient.mjs");
const numberIn = (file, re) => {
  const m = fs.existsSync(file) && re.exec(fs.readFileSync(file, "utf8"));
  return m ? Number(m[1]) : 0;
};
/** The protocol number of the UI5 frontend in `webapp` (core/Server.js). */
export const frontendProtocol = (webapp) => (webapp ? numberIn(path.join(webapp, "core", "Server.js"), /\bPROTOCOL:\s*(\d+)/) : 0);
/** What each implementation at hand speaks; 0: not installed, or none declared. */
export const SPEAKS = Object.freeze({
  "node-runtime": runtimeProtocol(),
  cap2ui5: fs.existsSync(CAP_PLUGIN) ? runtimeProtocol(CAP_PLUGIN, CAP_HOST) : 0,
  agent: numberIn(VENDORED_CLIENT, /^export const PROTOCOL = (\d+);/m),
});
/** Whether `name` (a backend, or the agent client) is behind this revision. */
export const behind = (name) => SPEAKS[name] !== PROTOCOL;
/** The one check that says a backend is behind, and the one for a frontend. */
export const BEHIND_BACKEND_CHECK = "response.protocol";
export const BEHIND_FRONTEND_CHECK = "slots.main";
/** The filter the backend suite runs with against `backend`: the whole
 *  suite, or - behind - the one check that says so. */
export const backendFilter = (backend) => (behind(backend) ? [BEHIND_BACKEND_CHECK] : undefined);

/**
 * The checks of the windowed tables (spec/windowed-tables.md) describe the
 * app-driven window, which abap2UI5 merged to main with 694fb262 (#3032)
 * and released with 1.151.0. Both reference hosts pin releases with it -
 * @abap2ui5/node-runtime 1.151.0, and @cap2ui5/cds-plugin 0.8.0 (on the
 * runtime 1.151.0) - and pass every window check. A node runtime without
 * it (a protocol-3 build packed before 694fb262) cannot start the app
 * WINDOW: the host leaves it out of its build
 * (conformance/hosts/node-runtime/build.mjs), every window check then ends
 * on the app's start - the MUST checks fail, the SHOULD
 * `window.request-bounds` warns - and they are pinned for it below. Until
 * 1.151.0 that was the released runtime, and the cap2UI5 host (plugin
 * 0.7.0 refused window_bind_tab( { total, event } )) was pinned the same
 * way (conformance/RESULTS.md).
 */
const NODE_FIX = "abap2UI5 main 694fb262, released with 1.151.0: @abap2ui5/node-runtime with the app-driven window (window_bind_tab( val total event window )) - the host leaves the app WINDOW out of its build on a runtime without it";
const MUST_IDS = ["window.first-window", "window.app-event", "window.request-sort-filter", "window.total-from-app",
  "window.order-with-the-draft", "window.delta-rows", "window.delta-rows-reference", "window.whole-table-written"];
const SHOULD_IDS = ["window.request-bounds"];
const pins = (list, fix) => Object.freeze(Object.fromEntries(list.map((id) => [id, fix])));
const WINDOW_MUST = pins(MUST_IDS, NODE_FIX);
const WINDOW_SHOULD = pins(SHOULD_IDS, NODE_FIX);
const DETAILS = "cap2UI5 answers a JavaScript app's exception with a correlation id and logs the text - by design";

/**
 * Whether the installed @abap2ui5/node-runtime has the app-driven window.
 * The released 1.151.0 (package.json, CI) has, as has a runtime built from
 * abap2UI5 main 694fb262 or later, and passes every window check; a
 * protocol-3 build before 694fb262 has not - so the node-runtime pins
 * follow what is installed, and stay exact for both. The cap2UI5 host has
 * no such switch: plugin 0.8.0 hosts 1.151.0.
 */
export const NODE_RUNTIME_APP_DRIVEN = appDrivenWindow();

/**
 * Backend-suite checks a reference backend fails today (a MUST), per backend
 * and by check id, in the order the suite runs them. None on the releases
 * the hosts pin: the windowed tables were pinned for both until
 * @abap2ui5/node-runtime 1.151.0 and @cap2ui5/cds-plugin 0.8.0;
 * `error.no-reflection` (the request URL reflected into the
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
  cap2ui5: Object.freeze({}),
});

/**
 * SHOULD checks a reference backend does not meet (a warning), the same way.
 * `error.details`: cap2UI5 hides a JavaScript app's exception text
 * (conformance/RESULTS.md). `window.request-bounds`: the windowed tables, as
 * above, on a node runtime without the app-driven window.
 */
export const BACKEND_EXPECTED_WARNINGS = Object.freeze({
  "node-runtime": NODE_RUNTIME_APP_DRIVEN ? Object.freeze({}) : WINDOW_SHOULD,
  cap2ui5: Object.freeze({ "error.details": DETAILS }),
});

/**
 * What the recorded traffic (traffic/<backend>/suite.json) carries: it was
 * recorded with the node-runtime host on the released
 * @abap2ui5/node-runtime 1.151.0 - protocol 3, every check passes - and
 * with the cap2UI5 host on @cap2ui5/cds-plugin 0.8.0 (runtime 1.151.0),
 * every MUST passes and `error.details` warns (conformance/RESULTS.md,
 * "What the traffic is recorded against"). test/traffic.test.mjs reads
 * these, not the pins of what is installed.
 */
export const RECORDED_FAILURES = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({}),
});
export const RECORDED_WARNINGS = Object.freeze({
  "node-runtime": Object.freeze({}),
  cap2ui5: Object.freeze({ "error.details": DETAILS }),
});
/** Why traffic/cap2ui5/ is not there (null: it is recorded, on
 *  @cap2ui5/cds-plugin 0.8.0). */
export const CAP_TRAFFIC_MISSING = null;
/**
 * Recorded traffic that is still protocol 2 and kept, its exchanges not
 * validated against the schemas of this revision. None since the agent
 * client is vendored at mcp-server 8a1d7d8 (protocol 3): its traffic
 * (traffic/<backend>/agent-client.json) is recorded on the releases and
 * validated like the rest; until then traffic/node-runtime/agent-client.json
 * was the one of mcp-server 332a0b0 against a protocol-2 runtime, kept for
 * its snapshots.
 */
export const TRAFFIC_PROTOCOL_2 = Object.freeze([]);

const ids = (pins, backend) => {
  if (!pins[backend]) throw new Error(`no pins for backend "${backend}" - node-runtime or cap2ui5`);
  return Object.freeze(Object.keys(pins[backend]));
};
/** The pinned failures of `backend` ("node-runtime" | "cap2ui5"), in suite
 *  order - of a backend that is behind, the one check it is measured by. */
export const expectedFailureIds = (backend) => (behind(backend) ? Object.freeze([BEHIND_BACKEND_CHECK]) : ids(BACKEND_EXPECTED_FAILURES, backend));
/** The pinned warnings of `backend`, in suite order. */
export const expectedWarningIds = (backend) => (behind(backend) ? Object.freeze([]) : ids(BACKEND_EXPECTED_WARNINGS, backend));
/** The failures and warnings the recorded traffic of `backend` carries. */
export const recordedFailureIds = (backend) => ids(RECORDED_FAILURES, backend);
export const recordedWarningIds = (backend) => ids(RECORDED_WARNINGS, backend);

/**
 * The checks whose recorded traffic cannot be compared between the two
 * backends because one of them never gets past the app's start. None since
 * @cap2ui5/cds-plugin 0.8.0 starts the app WINDOW: every check is answered
 * identically by both (test/traffic.test.mjs). (The windowed tables were
 * here while the plugin could not start it, the two of the app REF while
 * cap2UI5 0.6.0 could not start that.)
 */
export const BACKEND_TRAFFIC_APART = Object.freeze([]);

/**
 * The checks whose recorded traffic the two backends answer alike but for
 * the draft ids, because each takes another branch the spec allows. Compared
 * with every draft id the same (test/traffic.test.mjs), the reason here.
 */
export const BACKEND_TRAFFIC_IDS_APART = Object.freeze({
  "action.timer-declared": "cap2UI5 (@cap2ui5/cds-plugin 0.8.0) answers the tick that changed nothing while the declared timer runs with the id it continued - abap2UI5 sends nothing for an unchanged running timer (spec/actions.md#a-timer-the-backend-keeps); the node-runtime host never reuses an id",
  "session.timer-tick": "cap2UI5 (@cap2ui5/cds-plugin 0.8.0) answers the tick that changed nothing with the id it continued - the MAY of spec/sessions.md#draft-ids; the node-runtime host never reuses an id",
});
