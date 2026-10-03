# Changelog

## Unreleased

- **Frontend conformance suite** (`abap2ui5-conformance frontend --adapter
  ui5|agent|webcomponent [--profile core|portable|ui5|semantic]`, library
  `runFrontendSuite`, also at `@abap2ui5/protocol/frontend`): a scripted
  backend answers the frontend under test from the recorded traffic plus
  synthetic edge cases (PROTOCOL 3, no PROTOCOL, 500 with markup, CSRF token
  layer, unknown follow-up action, NEST slots, a model push of another
  app); 81 checks (66 MUST, 15 SHOULD) over the request side (envelope, ID
  continuation, event arguments, model delta, CONFIG cadence, headers,
  stateful session id, CSRF handshake, no retry of a 500, one roundtrip at
  a time) and the response side (PROTOCOL, unknown keys, view slots, model
  push, follow-up actions, messages, router, errors) per profile.
- **Adapters:** the UI5 SPA (abap2UI5 `app/webapp`) in Chromium via
  Playwright, UI5 from the `@openui5` npm packages (no CDN); the agent
  client of abap2UI5/mcp-server (vendored at `ea4e9fa`, `npm run
  vendor:agent`); the UI5 Web Components frontend (`dist/abap2ui5-wc.js`);
  a documented stub for the headless ABAP simulator (no HTTP seam yet).
- **Results** ([conformance/RESULTS.md](conformance/RESULTS.md#frontend-suite)):
  the UI5 SPA passes every MUST but `portable.box-details` (message box
  details empty on OpenUI5 >= 1.120); the agent client fails 5 MUSTs.
- **Specification revision 0.2** - the frontend side made explicit where the
  suite found it implicit, each with its source: a frontend sends event
  arguments as raw JSON values and never converts them itself; an app start
  names its class; `MODEL` carries only edited attributes, a pushed value is
  no edit; a table cell travels as `__delta` (SHOULD) or as the whole
  table; `sap-contextid-accept: header` SHOULD; the session id is kept by
  every HTTP frontend; "one roundtrip at a time" covers programs driving a
  frontend; a PROTOCOL mismatch adopts nothing; an error body is shown
  verbatim, its markup not interpreted; message box details are shown with
  the box; the UI5 frontend is no longer called "a portable frontend by
  construction" - it renders every portable app but fails a view on an
  element it cannot load (`profiles/portable.md`). Every frontend rule names
  its frontend checks.
- **`spec/open-questions.md`**: the provisional decisions for the
  maintainer - the NEST rule, a new draft id per response, the URL in the
  error body, boolean arguments for non-ABAP backends, the detail of an
  app's error, and five from the frontend suite.
- CI: a `frontend` job (Chromium, abap2UI5 `app/webapp` at `5d7e91f` (main))
  runs the UI5 SPA; `npm test` runs the agent client always.

## 0.1.0 - 2026-10-03

First version.

- **Specification** of protocol 2 (revision 0.1), derived from abap2UI5
  1.146.0: core (`spec/core.md`), transport, request, response, actions,
  sessions, navigation, errors, versioning - every normative statement
  traced to its source.
- **View profiles:** UI5 (`profiles/ui5.md`); portable v1
  (`profiles/portable.md`, `portable-v1.json`, `portable-coverage.md`) from a
  census of 247 core apps and 642 samples-controls ports; semantic - agent
  snapshot v1, moved here from abap2UI5/mcp-server as the normative version.
- **JSON Schemas** (2020-12) for the request, the response, the snapshot and
  the portable profile.
- **Backend conformance suite** (`abap2ui5-conformance backend`, library
  `runBackendSuite`): 75 checks, profiles `core` and `ui5`.
- **Conformance apps** `Z2UI5_CL_CONF_*` in ABAP (abapGit) and as cap2UI5
  apps; reference hosts for `@abap2ui5/node-runtime` and cap2UI5.
- **Recorded traffic** of both reference backends (suite, UI5 frontend code,
  agent client). Both pass every MUST; cap2UI5 warns on `error.details`.
