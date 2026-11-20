# The abap2UI5 protocol - specification

**Protocol 2, specification revision 0.5 (2026-11-16).** Derived from the
implementations, not designed ahead of them: abap2UI5 commit `6f55b04`
(the release commit of framework version 1.149.0) for the backend and the
UI5 frontend, `@abap2ui5/node-runtime` 1.149.0, `@cap2ui5/cds-plugin` 0.6.0
(which hosts the same runtime), abap2UI5/mcp-server
`ea4e9fa` and abap2UI5/headless-frontend `c1c24ba` (its simulator class is
`z2ui5_cl_frontend_sim` since `8f37e54`). Revisions 0.1 to 0.3
were derived from abap2UI5 `b812079` (1.146.0), revision 0.4 from `610d9ae`
(1.148.0). The windowed tables are derived from abap2UI5 branch DEV,
`186f2c9b`, which replaced the window of 1.149.0 by an app-driven one
([windowed-tables.md](windowed-tables.md)). What moved on the wire since
is listed in [../CHANGELOG.md](../CHANGELOG.md).

| Document | Content |
|---|---|
| [core.md](core.md) | roles, the roundtrip, what is core and what is a profile, terms, conformance |
| [transport.md](transport.md) | HTTP: endpoint, GET page vs POST roundtrip, headers, CSRF, HEAD, stateful sessions |
| [request.md](request.md) | the request body: `S_FRONT`, events and their arguments, the model delta, `CONFIG` |
| [response.md](response.md) | the response body: `S_FRONT`, the action queues, view slots, `MODEL`, processing order |
| [actions.md](actions.md) | follow-up actions (`T_CUSTOM`): messages, the vocabulary, unknown actions |
| [windowed-tables.md](windowed-tables.md) | a table the app loads a window at a time: the window state, the window request as the app's event, sorters and filters, edits |
| [sessions.md](sessions.md) | drafts, draft ids, snapshots, expiry, failed roundtrips, the session block |
| [navigation.md](navigation.md) | which app a request starts, the app stack, routes, the app-state hash, the router action |
| [errors.md](errors.md) | the error response and how a frontend treats it |
| [versioning.md](versioning.md) | the protocol number, compatibility rules, this document's own version |
| [open-questions.md](open-questions.md) | decisions taken provisionally, for the maintainer: current decision, alternatives |

The view profiles are in [../profiles/](../profiles/README.md), the JSON
Schemas in [../schema/](../schema/), the conformance suites in
[../conformance/](../conformance/README.md).

## Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD
NOT**, **RECOMMENDED**, **MAY** and **OPTIONAL** are to be read as described
in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

- A statement in a normal paragraph with one of those words is normative.
- **Implementation note** marks what the reference implementation does that
  looks accidental or historic. It is recorded so nobody is surprised by it;
  it is not a requirement, and another implementation does not have to copy
  it.
- **Checked by** names the backend-suite checks
  ([../conformance/backend/](../conformance/backend/README.md)) that test a
  statement; **Frontend check(s)** the frontend-suite checks
  ([../conformance/frontend/](../conformance/frontend/README.md)).
- Questions a maintainer still has to decide - with the current decision
  and the alternatives - are in [open-questions.md](open-questions.md).
- JSON keys are written as they travel (`S_FRONT.ID`). Keys of the request
  and response bodies are upper case; option objects inside actions are
  lower camel case.

## Sources

Every normative statement names where the behaviour lives, in brackets: the
abbreviation of the file and the method or function. Paths are relative to
the repository named.

| Abbreviation | File |
|---|---|
| **[HTTP]** | abap2UI5 `src/02/z2ui5_cl_ui5_http_handler.clas.abap` - the HTTP entry point |
| **[H]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_handler.clas.abap` - parse, dispatch, serialize one roundtrip |
| **[ACT]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_action.clas.abap` - start, continue, call and leave factories |
| **[FE]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_frontend.clas.abap` - builds and queues the actions |
| **[EV]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_event.clas.abap` - event wires and action arrays |
| **[MOD]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_model.clas.abap` - model serialization and the delta |
| **[WIN]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_window.clas.abap` - the request parser of a windowed table: `request`, `event`, `parse_sort`, `parse_filter`, `count_of` (branch DEV; the order and the window request in 1.149.0) |
| **[BND]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_bind.clas.abap` - what a bind call registers for an attribute |
| **[MSG]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_message.clas.abap` - what a message box shows |
| **[CL]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_client.clas.abap` - the client API implementation |
| **[TY]** | abap2UI5 `src/01/02/z2ui5_if_ui5_types.intf.abap` - wire constants and types, `c_protocol` |
| **[IC]** | abap2UI5 `src/02/z2ui5_if_client.intf.abap` - the public client API |
| **[DR]** | abap2UI5 `src/01/01/z2ui5_cl_ui5_srv_draft.clas.abap` - the draft store |
| **[EXIT]** | abap2UI5 `src/02/z2ui5_if_ui5_exit.intf.abap`, `src/01/04/z2ui5_cl_ui5_user_exit.clas.abap` |
| **[SRV]** | abap2UI5 `app/webapp/core/Server.js` - request building, HTTP, response adoption |
| **[SES]** | abap2UI5 `app/webapp/core/Session.js` - the session block and location cadence |
| **[LIB]** | abap2UI5 `app/webapp/core/Lib.js` - `buildDeltaFromPaths`, `normalizeEventArgs`, `bindingPathOf`, `isValidContextId` |
| **[V1]** | abap2UI5 `app/webapp/controller/View1.controller.js` - `eB`, `eBP`, `eF`, the processing phases |
| **[FA]** | abap2UI5 `app/webapp/core/FrontendAction.js` - action dispatch |
| **[CC]** | abap2UI5 `app/webapp/core/actions/ControlCall.js` - `CONTROL_GLOBAL`, `GLOBAL_TARGETS` |
| **[SL]** | abap2UI5 `app/webapp/core/actions/Slots.js`, `app/webapp/core/ViewSlots.js` - the view slots |
| **[WM]** | abap2UI5 `bundle/webapp/core/WindowModel.js` (branch DEV; `app/webapp/core/` in 1.149.0) - the model and the list binding of a windowed table |
| **[WT]** | abap2UI5 `node/srv/zcl_tst_window.clas.abap`, `node/tests/e2e/window.spec.js` (branch DEV) - the fixture app and the e2e tests of the windowed table |
| **[LP]** | abap2UI5 `app/webapp/core/actions/Launchpad.js` - the launchpad actions |
| **[OFF]** | abap2UI5 `app/webapp/core/Offline.js`, `app/webapp/core/actions/Browser.js` (`evOfflineQueue`) - the offline queue |
| **[RT]** | abap2UI5 `app/webapp/core/Router.js` - hash routes and the `ROUTER` action |
| **[EVW]** | abap2UI5 `app/webapp/core/ErrorView.js` - the error overlay |
| **[SF]** | abap2UI5 `app/webapp/core/ScrollFocus.js` - focus and scroll positions |
| **[NR]** | `@abap2ui5/node-runtime` `srv/host.mjs`, `srv/hostcore.mjs`, `srv/compress.mjs`, `srv/hostguard.mjs` |
| **[CAP]** | cap2UI5 `plugin/cds-plugin.js`, `plugin/lib/define-app.js` |
| **[AC]** | abap2UI5/mcp-server `lib/appclient.mjs`, `lib/snapshot.mjs` |
| **[HF]** | abap2UI5/headless-frontend `src/z2ui5_cl_frontend_sim.clas.abap` |

Recorded traffic of both backends and three frontends is in
[../traffic/](../traffic/); every message in it validates against the
schemas (`npm test`).
