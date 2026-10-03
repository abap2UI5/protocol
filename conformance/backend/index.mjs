/*
 * @abap2ui5/protocol - the backend conformance suite as a library.
 *
 *   import { runBackendSuite } from "@abap2ui5/protocol";
 *   const report = await runBackendSuite({ url: "http://localhost:3000/", profile: "core" });
 *   report.ok            // no MUST failed
 *   report.results       // [{ id, title, level, profile, spec, status, message }]
 *
 * See conformance/backend/README.md.
 */
export { runBackendSuite, DEFAULT_APPS, PROFILES, canonical } from "./lib/runner.mjs";
export { ALL_CHECKS } from "./lib/checks/index.mjs";
export {
  ProtocolClient, ROUNDTRIP_HEADERS, sFront, systemActions, customActions, displays, displayOf,
  destroys, routerOptions, hasModel, model,
} from "./lib/client.mjs";
export { validate, compile, loadSchema, formatErrors, SCHEMA_DIR } from "./lib/schema.mjs";
export { formatResult, formatSummary } from "./lib/report.mjs";
// The frontend suite (conformance/frontend/) - also at "@abap2ui5/protocol/frontend".
export { runFrontendSuite, ALL_FRONTEND_CHECKS, ADAPTERS, FRONTEND_PROFILES } from "../frontend/index.mjs";
