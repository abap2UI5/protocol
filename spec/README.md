# The abap2UI5 protocol - specification

**Protocol 3, specification revision 0.6 (2026-11-22).** Derived from the
implementations, not designed ahead of them: abap2UI5 branch `DEV` at
`1445078` - the framework after 1.150.0, with protocol 3 - for the backend
and the UI5 frontend, and the node runtime packed from that commit; no
release carries protocol 3 yet. The implementations outside that
repository still speak protocol 2 and are cited for what did not change:
`@cap2ui5/cds-plugin` 0.7.0 (which hosts the released runtime),
abap2UI5/mcp-server `332a0b0` and abap2UI5/headless-frontend `c1c24ba`
(its simulator class is `z2ui5_cl_frontend_sim` since `8f37e54`).
Revisions 0.1 to 0.5 describe protocol 2: 0.1 to 0.3 were derived from
abap2UI5 `b812079` (1.146.0), 0.4 from `610d9ae` (1.148.0), 0.5 from
`6f55b04` (1.149.0) and, for the windowed tables, from main `694fb262`
(#3032, after 1.150.0), which replaced the window of 1.149.0 and 1.150.0
by an app-driven one ([windowed-tables.md](windowed-tables.md)). What
protocol 3 broke is in [versioning.md](versioning.md#what-protocol-3-broke);
what moved on the wire since revision 0.1 is listed in
[../CHANGELOG.md](../CHANGELOG.md).

| Document | Content |
|---|---|
| [core.md](core.md) | roles, the roundtrip, what is core and what is a profile, terms, conformance |
| [transport.md](transport.md) | HTTP: endpoint, GET page vs POST roundtrip, headers, CSRF, HEAD, stateful sessions |
| [request.md](request.md) | the request body: `S_FRONT`, `ROUTE`, events and their arguments, the model delta, `CONFIG` |
| [response.md](response.md) | the response body: `S_FRONT`, the sections `VIEWS`, `NAV` and `ACTIONS`, view slots, `MODEL`, processing order |
| [actions.md](actions.md) | follow-up actions (`ACTIONS`): messages, the vocabulary, unknown actions |
| [windowed-tables.md](windowed-tables.md) | a table the app loads a window at a time: the window state, the window request as the app's event, sorters and filters, edits |
| [sessions.md](sessions.md) | drafts, draft ids, snapshots, expiry, failed roundtrips, the session block |
| [navigation.md](navigation.md) | which app a request starts, the app stack, routes, the app-state hash, the app-owned hash, the `NAV` section |
| [errors.md](errors.md) | the error response and how a frontend treats it |
| [versioning.md](versioning.md) | the protocol number, what protocol 3 broke, compatibility rules, this document's own version |
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
  and response bodies are upper case; option objects - of an action, of a
  display (`OPT`), of `NAV` - are lower camel case.

## Sources

Every normative statement names where the behaviour lives, in brackets: the
abbreviation of the file and the method or function. Paths are relative to
the repository named.

| Abbreviation | File |
|---|---|
| **[HTTP]** | abap2UI5 `src/02/z2ui5_cl_ui5_http_handler.clas.abap` - the HTTP entry point |
| **[H]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_handler.clas.abap` - parse, dispatch, serialize one roundtrip: `request_parse_body`, `request_json_to_abap` (the app start from `ROUTE` and `SEARCH`), `response_abap_to_json` (the sections) |
| **[ACT]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_action.clas.abap` - start, continue, call and leave factories; the teardown of the standalone slots on a hop (`prepare_app_stack`) and on an app start (`factory_first_start`) |
| **[FE]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_frontend.clas.abap` - collects what a roundtrip says about the slots and the URL and writes the sections (`slots_serialize`, `nav_serialize`); builds the message actions |
| **[EV]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_event.clas.abap` - event wires (`get_event`: the options object) and action arrays |
| **[MOD]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_model.clas.abap` - model serialization and the delta |
| **[WIN]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_window.clas.abap` - the request parser of a windowed table: `request`, `event`, `parse_sort`, `parse_filter`, `count_of` (main `694fb262`; the order and the window request up to 1.150.0) |
| **[BND]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_bind.clas.abap` - what a bind call registers for an attribute |
| **[MSG]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_srv_message.clas.abap` - what a message box shows |
| **[CL]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_client.clas.abap` - the client API implementation |
| **[TY]** | abap2UI5 `src/01/02/z2ui5_if_ui5_types.intf.abap` - wire constants and types, `c_protocol` |
| **[IC]** | abap2UI5 `src/02/z2ui5_if_client.intf.abap` - the public client API |
| **[DR]** | abap2UI5 `src/01/01/z2ui5_cl_ui5_srv_draft.clas.abap` - the draft store |
| **[EXIT]** | abap2UI5 `src/02/z2ui5_if_ui5_exit.intf.abap`, `src/01/04/z2ui5_cl_ui5_user_exit.clas.abap` |
| **[SRV]** | abap2UI5 `bundle/webapp/core/Server.js` (`app/webapp` up to 1.149.0, like every frontend file below) - request building, HTTP, response adoption, `PROTOCOL` |
| **[SES]** | abap2UI5 `bundle/webapp/core/Session.js` - the session block and location cadence |
| **[LIB]** | abap2UI5 `bundle/webapp/core/Lib.js` - `buildDeltaFromPaths`, `normalizeEventArgs`, `eventOptions`, `bindingPathOf`, `isValidContextId` |
| **[V1]** | abap2UI5 `bundle/webapp/controller/View1.controller.js` - `eB`, `eBP`, `eF`, the processing phases (`_applyViews`, `_runPendingActions`, `_dispatchQueuedEvent`) |
| **[FA]** | abap2UI5 `bundle/webapp/core/FrontendAction.js` - action dispatch |
| **[CC]** | abap2UI5 `bundle/webapp/core/actions/ControlCall.js` - `CONTROL_GLOBAL`, `GLOBAL_TARGETS` |
| **[SL]** | abap2UI5 `bundle/webapp/core/actions/Slots.js`, `bundle/webapp/core/ViewSlots.js` - the view slots |
| **[WM]** | abap2UI5 `bundle/webapp/core/WindowModel.js` (main `694fb262`) - the model and the list binding of a windowed table |
| **[WT]** | abap2UI5 `node/srv/zcl_tst_window.clas.abap`, `node/tests/e2e/window.spec.js` (main `694fb262`) - the fixture app and the e2e tests of the windowed table |
| **[LP]** | abap2UI5 `bundle/webapp/core/actions/Launchpad.js` - the launchpad actions |
| **[RT]** | abap2UI5 `bundle/webapp/core/Router.js` - the one reader and writer of the hash: routes, `startRoute` (what a request sends as `ROUTE`), `sync` (the `NAV` section) |
| **[EVW]** | abap2UI5 `bundle/webapp/core/ErrorView.js` - the error overlay |
| **[SF]** | abap2UI5 `bundle/webapp/core/ScrollFocus.js` - focus and scroll positions |
| **[NR]** | `@abap2ui5/node-runtime` `srv/host.mjs`, `srv/hostcore.mjs`, `srv/compress.mjs`, `srv/hostguard.mjs` |
| **[CAP]** | cap2UI5 `plugin/cds-plugin.js`, `plugin/lib/define-app.js` |
| **[AC]** | abap2UI5/mcp-server `lib/appclient.mjs`, `lib/snapshot.mjs` |
| **[HF]** | abap2UI5/headless-frontend `src/z2ui5_cl_frontend_sim.clas.abap` |

Recorded traffic is in [../traffic/](../traffic/); every message in it
validates against the schemas (`npm test`).
