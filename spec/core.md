# Core protocol

## Roles

- An **app** is a class with a `main( client )` method (`z2ui5_if_app`,
  [IC]). It decides what is shown and handles every event. Apps are written
  in ABAP, or - on cap2UI5 - in JavaScript against the same client API
  ([CAP] `defineApp`).
- A **backend** hosts apps. Per request it restores the app from its draft,
  applies the model delta, runs `main( )` and answers with what the app
  asked for. Implementations: abap2UI5 itself on an ABAP system ([HTTP],
  [H]); the same framework transpiled to JavaScript,
  `@abap2ui5/node-runtime` ([NR]); cap2UI5, a CAP plugin hosting that
  runtime with drafts in a CDS entity ([CAP]).
- A **frontend** renders what the backend answers and sends the user's
  events back. Implementations: the UI5 SPA (abap2UI5 `app/webapp`, [SRV],
  [V1]); the agent client of abap2UI5/mcp-server, which renders nothing and
  describes the screen as a snapshot instead ([AC]); the ABAP frontend
  simulator, which calls the handler in-process ([HF]).

The goal of this specification is that any frontend can be paired with any
backend.

## The roundtrip

```
frontend                                         backend
   | GET <endpoint>  (UI5 profile only)              |
   |<---- HTML page that boots the UI5 frontend ------|
   |                                                  |
   | POST <endpoint>  { "value": { S_FRONT, MODEL } } |  restore draft S_FRONT.ID
   |------------------------------------------------->|  apply MODEL (delta)
   |                                                  |  main( client ), nav hops
   |<--- 200 { S_FRONT: { ID, APP, PROTOCOL,          |  save new draft
   |              S_ACTION: { T_SYSTEM, T_CUSTOM } }, |
   |           MODEL? }                               |
   |  run T_SYSTEM (views, router), push MODEL,       |
   |  run T_CUSTOM (follow-up actions)                |
   | POST (next event, S_FRONT.ID = the new ID) ----->|  ...
```

Every interaction after the page load is one POST that carries an event
(or, for an app start, none) and the edits since the last roundtrip, and
one JSON answer that says what to show. The backend keeps the app's state
between roundtrips in a **draft**; the response's `S_FRONT.ID` names it and
the next request sends it back ([sessions.md](sessions.md)).

## Core protocol and profiles

The **core protocol** is mandatory for every frontend and every backend:

| Part | Document |
|---|---|
| Transport over HTTP | [transport.md](transport.md) |
| Request body | [request.md](request.md) |
| Response body, action queues, view slots, model | [response.md](response.md) |
| Follow-up actions | [actions.md](actions.md) |
| Sessions and drafts | [sessions.md](sessions.md) |
| Navigation | [navigation.md](navigation.md) |
| Errors | [errors.md](errors.md) |
| Versioning | [versioning.md](versioning.md) |

What the core protocol does **not** fix is the language of the views: a
`VIEW_SLOTS display` action carries the view as a string. That is the
business of a **view profile** ([../profiles/](../profiles/README.md)):

- the **UI5 profile** - full UI5 XML views, the abap2UI5 wire forms
  (`.eB(...)`, `.eF(...)`) inside them, the page that boots the UI5
  frontend. Only the UI5 SPA implements it fully;
- the **portable profile** - a defined subset of UI5 XML controls,
  properties, binding forms, event wires and frontend actions that every
  conforming non-UI5 renderer renders;
- the **semantic profile** - agent snapshot v1, the description of a
  screen as data (fields, actions, tables, messages) for frontends that do
  not render at all.

A backend serves views in the UI5 vocabulary; whether an app stays inside
the portable profile is a property of the app, not of the backend.

## Terms

| Term | Meaning |
|---|---|
| draft | the persisted state of one app instance after one roundtrip, named by a draft id |
| draft id | `S_FRONT.ID` - an opaque string; the reference uses 32 upper-case hex characters ([ACT] `uuid_get_c32`) |
| event | a named user interaction a view wires to the backend (`EVENT`) |
| wire | the handler expression in a view attribute that fires an event (UI5 profile: `.eB(['SAVE'])`) |
| slot | one of the five places a view can be shown: `MAIN`, `NEST`, `NEST2`, `POPUP`, `POPOVER` |
| system action | an entry of `T_SYSTEM`: a view-lifecycle or router call the frontend runs first |
| follow-up action | an entry of `T_CUSTOM`: something the app asked the frontend to do after rendering |
| model | the JSON object a view binds to; it holds the app's **bound** attributes, upper case |
| model delta | the part of the model the user changed, sent with the next event |
| app start | a request without draft id: the backend creates (or restores) an app |
| app stack | the chain of apps `nav_app_call` builds and `nav_app_leave` unwinds |

## Conformance

- A **conforming backend** implements every MUST of the core documents for
  the requests a frontend sends, and serves the conformance apps
  ([../conformance/apps/README.md](../conformance/apps/README.md)) so the
  backend suite can verify it. Its conformance is reported per profile:
  `core`, or `ui5` (core plus [../profiles/ui5.md](../profiles/ui5.md)).
- A **conforming frontend** implements every MUST that addresses a frontend,
  and renders at least one view profile. Its suite is reserved
  ([../conformance/frontend/README.md](../conformance/frontend/README.md)).
- An **in-process frontend** - one that calls the backend's handler without
  HTTP, as [HF] does - implements the request and response bodies and is
  exempt from [transport.md](transport.md).

Where this specification and an implementation disagree, the disagreement
is a bug in one of them; the backend suite decides which, and the
specification is corrected when the implementation was right.
