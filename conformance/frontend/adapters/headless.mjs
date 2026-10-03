/*
 * Adapter stub: the headless ABAP frontend simulator
 * (abap2UI5/headless-frontend, z2ui5_cl_frontend_simulator).
 *
 * Not drivable by this suite yet - documented future work
 * (conformance/frontend/README.md, "Adapters"). The simulator is an
 * in-process frontend (spec/core.md#conformance): it fills the request
 * STRUCTURE of z2ui5_cl_ui5_handler, constructs the handler
 * (`NEW z2ui5_cl_ui5_handler( lv_request )`) and calls `main( )`, which
 * answers the response structure - there is no JSON and no HTTP between the
 * two, so a scripted HTTP backend never sees it. Driving it needs one of:
 *
 *   - a seam in the simulator for the roundtrip (an interface with the
 *     handler call as the default implementation and an HTTP/JSON one), so
 *     the transpiled simulator can post to the mock; or
 *   - an ABAP Unit test double for z2ui5_cl_ui5_handler that answers the
 *     scripted responses (parsed into the response structure) - the
 *     frontend suite in ABAP, run on the transpiled runtime like the
 *     simulator's own tests (headless-frontend .github/scripts/unit.mjs).
 *
 * Either is a change in abap2UI5/headless-frontend, not here.
 */
import { Unsupported } from "./base.mjs";

export function createHeadlessAdapter() {
  const no = async () => {
    throw new Unsupported("the headless ABAP simulator is an in-process frontend without an HTTP seam - see conformance/frontend/adapters/headless.mjs");
  };
  return {
    name: "headless",
    description: "the headless ABAP simulator (abap2UI5/headless-frontend) - not drivable yet",
    profiles: ["core", "semantic"],
    capabilities: new Set(),
    open: no,
    start: no,
    fill: no,
    press: no,
    settle: async () => {},
    state: async () => ({}),
    stop: async () => {},
    close: async () => {},
  };
}
