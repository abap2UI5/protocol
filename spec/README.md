# The abap2UI5 protocol - specification

**Protocol 2, specification revision 0.2 (2026-10-03).** Derived from the
implementations, not designed ahead of them: abap2UI5 commit `b812079`
(framework version 1.146.0) for the backend and the UI5 frontend,
`@abap2ui5/node-runtime` 1.146.0, `@cap2ui5/cds-plugin` 0.4.0
(cap2UI5 `cad7f1f`), abap2UI5/mcp-server `ea4e9fa` and
abap2UI5/headless-frontend `c1c24ba`.

| Document | Content |
|---|---|
| [core.md](core.md) | roles, the roundtrip, what is core and what is a profile, terms, conformance |
| [transport.md](transport.md) | HTTP: endpoint, GET page vs POST roundtrip, headers, CSRF, HEAD, stateful sessions |
| [request.md](request.md) | the request body: `S_FRONT`, events and their arguments, the model delta, `CONFIG` |
| [response.md](response.md) | the response body: `S_FRONT`, the action queues, view slots, `MODEL`, processing order |
| [actions.md](actions.md) | follow-up actions (`T_CUSTOM`): messages, the vocabulary, unknown actions |
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
| **[CL]** | abap2UI5 `src/01/02/z2ui5_cl_ui5_client.clas.abap` - the client API implementation |
| **[TY]** | abap2UI5 `src/01/02/z2ui5_if_ui5_types.intf.abap` - wire constants and types, `c_protocol` |
| **[IC]** | abap2UI5 `src/02/z2ui5_if_client.intf.abap` - the public client API |
| **[DR]** | abap2UI5 `src/01/01/z2ui5_cl_ui5_srv_draft.clas.abap` - the draft store |
| **[EXIT]** | abap2UI5 `src/02/z2ui5_if_ui5_exit.intf.abap`, `src/01/04/z2ui5_cl_ui5_user_exit.clas.abap` |
| **[SRV]** | abap2UI5 `app/webapp/core/Server.js` - request building, HTTP, response adoption |
| **[SES]** | abap2UI5 `app/webapp/core/Session.js` - the session block and location cadence |
| **[LIB]** | abap2UI5 `app/webapp/core/Lib.js` - `buildDeltaFromPaths`, `normalizeEventArgs`, `isValidContextId` |
| **[V1]** | abap2UI5 `app/webapp/controller/View1.controller.js` - `eB`, `eBP`, `eF`, the processing phases |
| **[FA]** | abap2UI5 `app/webapp/core/FrontendAction.js` - action dispatch |
| **[CC]** | abap2UI5 `app/webapp/core/actions/ControlCall.js` - `CONTROL_GLOBAL`, `GLOBAL_TARGETS` |
| **[SL]** | abap2UI5 `app/webapp/core/actions/Slots.js`, `app/webapp/core/ViewSlots.js` - the view slots |
| **[RT]** | abap2UI5 `app/webapp/core/Router.js` - hash routes and the `ROUTER` action |
| **[EVW]** | abap2UI5 `app/webapp/core/ErrorView.js` - the error overlay |
| **[SF]** | abap2UI5 `app/webapp/core/ScrollFocus.js` - focus and scroll positions |
| **[NR]** | `@abap2ui5/node-runtime` `srv/host.mjs`, `srv/compress.mjs` |
| **[CAP]** | cap2UI5 `plugin/cds-plugin.js`, `plugin/lib/define-app.js` |
| **[AC]** | abap2UI5/mcp-server `lib/appclient.mjs`, `lib/snapshot.mjs` |
| **[HF]** | abap2UI5/headless-frontend `src/z2ui5_cl_frontend_simulator.clas.abap` |

Recorded traffic of both backends and three frontends is in
[../traffic/](../traffic/); every message in it validates against the
schemas (`npm test`).
