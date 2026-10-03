/*
 * @abap2ui5/protocol/frontend - the frontend conformance suite as a library.
 *
 *   import { runFrontendSuite } from "@abap2ui5/protocol";
 *   const report = await runFrontendSuite({ adapter: "ui5", profile: "ui5" });
 *   report.ok            // no MUST failed
 *   report.results       // [{ id, title, level, profile, spec, status, message }]
 *
 * See conformance/frontend/README.md.
 */
export { runFrontendSuite, FRONTEND_PROFILES, payloadOf } from "./lib/runner.mjs";
export { ALL_FRONTEND_CHECKS } from "./lib/checks/index.mjs";
export { ADAPTERS, createAdapter } from "./adapters/index.mjs";
export { Unsupported } from "./adapters/base.mjs";
export { startMock } from "./lib/mock.mjs";
export * as responses from "./lib/responses.mjs";
