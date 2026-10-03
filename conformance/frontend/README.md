# Frontend conformance suite

Plays the **backend**: a scripted HTTP server answers the roundtrips of the
frontend under test with recorded and synthetic responses, and the suite
checks what the frontend sends and what it does with the answers - against
the specification ([../../spec/](../../spec/README.md)) and the view profile
the frontend claims. Every request the frontend sends is validated against
[`schema/request.schema.json`](../../schema/request.schema.json); one more
request than the script expected (a retry, a duplicate) fails the check.

The backend suite ([../backend/](../backend/README.md)) is the other half:
it plays the frontend. Both are views of one recorded conversation - the
scripted responses here are the real backend's, from
[`traffic/node-runtime/`](../../traffic/node-runtime/) (`suite.json` and
`ui5-frontend.json`), plus synthetic answers for what no backend sends on
purpose (another `PROTOCOL`, an unknown follow-up action, a CSRF token
layer, a 500 with markup in it, a model push from another app).

## Run it

```bash
npm ci
npx abap2ui5-conformance frontend --adapter ui5            # the UI5 SPA in Chromium
npx abap2ui5-conformance frontend --adapter agent          # mcp-server's agent client
npx abap2ui5-conformance frontend --adapter webcomponent   # frontend-webcomponent
npx abap2ui5-conformance frontend --adapter adaptive-cards # the Adaptive Cards renderer of this package

# from this repository
npm run conformance:frontend:ui5
npm run conformance:frontend:agent
npm run conformance:frontend:adaptive-cards
```

| Option | |
|---|---|
| `--adapter <name>` | the frontend: `ui5`, `agent`, `webcomponent`, `adaptive-cards`, `headless` (stub) |
| `--profile core\|portable\|ui5\|semantic` | the checks to run: `core`; `portable` (core + portable); `ui5` (core + portable + UI5); `semantic` (core + semantic). Default: the widest profile the adapter claims |
| `--only <id part>` | run only checks whose id contains it (repeatable) |
| `--json` | the report as JSON |
| `--verbose` | the reasons of skipped checks and the last requests of every failure |

Exit code 0: no MUST check failed. 1: at least one did. 2: a usage error, or
the adapter could not start (no browser, no checkout) - the report says why.

A **MUST** check that fails is a `FAIL`; a **SHOULD** check that fails is a
`WARN`. A check is `SKIP`ped when it is outside the profile, needs a
capability the adapter does not have (a URL, timers, a DOM), or asked for an
interaction the frontend cannot perform (the agent client cannot address a
cell of a nested table) - a skip is no verdict. Every check starts a fresh
frontend instance against an endpoint of its own.

## Adapters

A frontend is plugged in by an adapter ([adapters/base.mjs](adapters/base.mjs)
has the contract): `open({ mock })`, `start(run, { app })` (a fresh instance
against the run's endpoint), the interactions `fill(target, value)`,
`press(target)`, `closeBox({ action, text })`, `back()`, `setModel(path,
value)`, then `settle()`, `state()` (the normalized state: slots and their
text, field values, models, messages, the error shown, diagnostics, hash,
title, focus) and `stop()` / `close()`. A target carries what every kind of
frontend needs to find it - `{ path: "/NAME", id: "name" }` for a field,
`{ text: "Check", event: "CHECK" }` for a button - and an interaction the
frontend cannot perform throws `Unsupported`.

| Adapter | Frontend | Profiles | Driven by |
|---|---|---|---|
| `ui5` | the official UI5 SPA, abap2UI5 `app/webapp` | core, portable, ui5 | Chromium via Playwright: the page is the UI5 profile's boot page ([adapters/ui5-page.mjs](adapters/ui5-page.mjs)) at the run's endpoint, UI5 comes from the `@openui5/*` npm packages (no CDN), the frontend from the checkout's webapp folder. Interactions type into real `Input`s and click real `Button`s |
| `agent` | abap2UI5/mcp-server `lib/appclient.mjs` | core, semantic | in process: `start` / `act`, the snapshot is the state. Vendored at the commit [adapters/vendor/mcp-server/source.json](adapters/vendor/mcp-server/source.json) names (`npm run vendor:agent` re-vendors; `MCP_SERVER_HOME` runs a checkout instead) |
| `webcomponent` | abap2UI5/frontend-webcomponent `dist/abap2ui5-wc.js` | core, portable | Chromium: `<abap2ui5-app standalone>` on its standalone page; needs a built checkout (`WC_FRONTEND_HOME`, else `../frontend-webcomponent`) |
| `adaptive-cards` | the Adaptive Cards renderer prototype of this repository ([../../renderers/adaptive-cards/](../../renderers/adaptive-cards/README.md)) | core, portable | in process: its card host speaks HTTP to the scripted backend, every answer is rendered into an Adaptive Card 1.5 and the state is read from the card (a `Container` per slot, inputs with binding paths as ids). `fill` types into a card input, `press` submits what a card host submits for the action - its data and every input value |
| `headless` | abap2UI5/headless-frontend (ABAP) | - | **not drivable yet** - see below |

What the `ui5` adapter needs: an abap2UI5 checkout (`ABAP2UI5_HOME`, else
`../abap2UI5` or `deps/abap2UI5` next to this repository), `playwright-core`
and the `@openui5/sap.m` packages (devDependencies), and a Chromium
(`npx playwright-core install chromium`, `CHROMIUM_BIN`, or
`PLAYWRIGHT_BROWSERS_PATH`). The page hooks two things to observe the
frontend without changing it: it counts the responses the MAIN controller
is processing (the frontend marks a response processed before its views are
built), and it records what reaches `sap.m.MessageToast` / `MessageBox`.
UI5 runs unthemed - the npm source packages carry the themes as LESS - which
changes nothing a check looks at.

**The headless ABAP simulator** is an in-process frontend
([../../spec/core.md](../../spec/core.md#conformance)): it fills the request
*structure* of `z2ui5_cl_ui5_handler` and calls `main( )`; no JSON and no
HTTP pass between the two, so a scripted HTTP backend never sees it.
Driving it needs a roundtrip seam in the simulator (the handler call as
one implementation, an HTTP/JSON one as another, so the transpiled
simulator can post to the mock) or this suite in ABAP (an ABAP Unit double
for the handler answering the scripted responses, on the transpiled runtime
the simulator's own tests use). Either is a change in
abap2UI5/headless-frontend; [adapters/headless.mjs](adapters/headless.mjs)
reserves the name.

## As a library

```js
import { runFrontendSuite } from "@abap2ui5/protocol/frontend";   // also exported by "@abap2ui5/protocol"

const report = await runFrontendSuite({
  adapter: "ui5",                  // or an adapter object of your own
  profile: "ui5",
  onResult: (r) => console.log(r.status, r.id),
});
report.ok; report.counts; report.version;   // version: what was driven
```

`report.results[]` is `{ id, title, level, profile, spec, status, message,
ms, roundtrips, traffic? }`. The package also exports the scripted backend
(`startMock`), the response builders (`responses`), `ALL_FRONTEND_CHECKS`
and `ADAPTERS`.

## Results

Per frontend in [../RESULTS.md](../RESULTS.md#frontend-suite).

## Checks

Generated from the suite (`node scripts/gen-check-list.mjs`; `npm test`
fails when it is out of date). *Needs* names the adapter capabilities a
check requires.

<!-- checks:begin - generated by scripts/gen-check-list.mjs, do not edit -->

| Check | Level | Profile | Needs | What | Spec |
|---|---|---|---|---|---|
| `request.envelope` | MUST | core | - | Every roundtrip POST is wrapped in the { value: ... } envelope | [transport.md#the-envelope](../../spec/transport.md#the-envelope) |
| `request.content-type` | MUST | core | - | Every roundtrip POST is sent with Content-Type: application/json | [transport.md#the-roundtrip-post](../../spec/transport.md#the-roundtrip-post) |
| `request.app-start` | MUST | core | - | The first request starts the app: no ID, ?app_start=<CLASS> in SEARCH | [request.md#app-start-shaped-requests](../../spec/request.md#app-start-shaped-requests) |
| `request.app-start-location` | SHOULD | core | - | The app start carries the endpoint's ORIGIN and PATHNAME | [request.md#app-start-shaped-requests](../../spec/request.md#app-start-shaped-requests) |
| `request.event` | MUST | core | - | A user event sends EVENT as the wire names it and the ID of the last response | [request.md#event-requests](../../spec/request.md#event-requests) |
| `request.id-continuation` | MUST | core | - | Every event continues the ID of the response adopted last - also an ID seen before | [sessions.md#draft-ids](../../spec/sessions.md#draft-ids) |
| `request.location-once` | SHOULD | core | - | Event requests leave out ORIGIN, PATHNAME and SEARCH | [request.md#s_front](../../spec/request.md#s_front) |
| `request.event-arguments` | MUST | core | - | T_EVENT_ARG holds the wire's arguments in order as raw JSON values (true stays true) | [request.md#event-arguments](../../spec/request.md#event-arguments) |
| `request.event-no-arguments` | SHOULD | core | - | An event whose wire has no arguments sends no T_EVENT_ARG | [request.md#shape](../../spec/request.md#shape) |
| `request.leave-event` | MUST | core | - | The leave wire (navButtonPress .eB(['___ZZZ_NAL'])) sends the reserved event ___ZZZ_NAL | [navigation.md#the-reserved-leave-event](../../spec/navigation.md#the-reserved-leave-event) |
| `request.client-prev` | MUST | core | - | MS_CLIENT_PREV, when sent, is a non-negative integer and never on the first request | [request.md#s_front](../../spec/request.md#s_front) |
| `request.no-empty-keys` | SHOULD | core | - | Empty values are left out (T_EVENT_ARG, SEARCH, HASH, MODEL, CONFIG) | [request.md#shape](../../spec/request.md#shape) |
| `request.config-cadence` | SHOULD | core | - | The static session block travels with the app start, not with every event | [request.md#config-the-session-block](../../spec/request.md#config-the-session-block) |
| `transport.contextid-accept` | SHOULD | core | - | Every roundtrip POST asks for the session id in a header (sap-contextid-accept: header) | [transport.md#request-headers](../../spec/transport.md#request-headers) |
| `transport.contextid-only-when-held` | MUST | core | - | sap-contextid is not sent before the backend handed one out, and never empty | [transport.md#request-headers](../../spec/transport.md#request-headers) |
| `transport.contextid-kept` | MUST | core | - | The last sap-contextid response header is sent with every later POST; a response without it keeps it | [transport.md#stateful-sessions-sap-contextid](../../spec/transport.md#stateful-sessions-sap-contextid) |
| `transport.csrf-token` | SHOULD | core | - | A 403 with X-CSRF-Token: Required is answered by a token fetch (HEAD) and the same body once more | [transport.md#csrf-and-origin](../../spec/transport.md#csrf-and-origin) |
| `transport.csrf-final` | MUST | core | - | A 403 without X-CSRF-Token: Required (the backend's own gate) is final - no re-send | [transport.md#csrf-and-origin](../../spec/transport.md#csrf-and-origin) |
| `transport.no-retry-500` | MUST | core | - | A 500 is not re-sent automatically | [transport.md#client-behaviour](../../spec/transport.md#client-behaviour) |
| `transport.one-at-a-time` | MUST | core | concurrent | While a roundtrip is in flight, a second user event starts no second roundtrip | [transport.md#client-behaviour](../../spec/transport.md#client-behaviour) |
| `model.only-edited` | MUST | core | - | MODEL names exactly the attributes the user edited | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.none-when-unedited` | MUST | core | - | An event after no edit sends no model delta | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.scalar` | MUST | core | - | An edited scalar travels whole: "NAME": <current value> | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.number-and-boolean` | MUST | core | - | A number and a boolean travel as JSON number and boolean | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.structure-whole` | MUST | core | - | An edited structure component sends the whole structure | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.table-cell` | MUST | core | - | Edited table cells reach the backend: as __delta rows (0-based) or as the whole table | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.table-row-delta` | SHOULD | core | - | Edited table cells travel as a __delta of exactly the edited cells | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.nested-table` | SHOULD | core | - | A cell of a nested table travels as a nested __delta (or the whole value) | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.whole-beats-delta` | MUST | core | modelEdit | An attribute edited both whole and by cell travels whole | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.slot-model` | MUST | core | - | An event from a popup sends the popup's edits only | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `model.absent-keeps` | MUST | core | - | A response without MODEL keeps the model, edits included | [response.md#model](../../spec/response.md#model) |
| `model.push` | MUST | core | - | A response with MODEL and no view updates the bindings on screen | [response.md#model](../../spec/response.md#model) |
| `model.push-own-app` | MUST | core | - | A pushed MODEL reaches only the slots of the app that answered | [response.md#model](../../spec/response.md#model) |
| `model.pending-survive-push` | SHOULD | core | concurrent | Edits made while a roundtrip is in flight survive its model push and travel next | [response.md#model](../../spec/response.md#model) |
| `model.unchanged-push-no-delta` | MUST | core | - | Values the backend pushed are no edits: the next event sends no delta for them | [request.md#the-model-delta](../../spec/request.md#the-model-delta) |
| `response.protocol-mismatch` | MUST | core | - | A response with another PROTOCOL is an error; its view is not shown | [versioning.md#the-protocol-number](../../spec/versioning.md#the-protocol-number) |
| `response.protocol-mismatch-message` | SHOULD | core | - | The protocol error names both protocol numbers | [versioning.md#the-protocol-number](../../spec/versioning.md#the-protocol-number) |
| `response.protocol-absent` | SHOULD | core | - | A response without PROTOCOL is let through | [versioning.md#the-protocol-number](../../spec/versioning.md#the-protocol-number) |
| `response.unknown-keys` | MUST | core | - | Unknown keys (S_FRONT, root, slot and ROUTER options) are ignored | [versioning.md#compatible-changes-within-protocol-2](../../spec/versioning.md#compatible-changes-within-protocol-2) |
| `response.no-actions` | MUST | core | - | A response without S_ACTION and MODEL changes nothing on screen | [response.md#s_front](../../spec/response.md#s_front) |
| `response.not-json` | MUST | core | - | A 2xx answer that is not JSON is an error | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `response.no-s-front` | MUST | core | - | A 2xx JSON answer without S_FRONT is an error | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `slots.main` | MUST | core | - | A MAIN display is rendered as the screen | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.popup` | MUST | core | - | A POPUP display opens over MAIN; a POPUP destroy closes it | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.popover` | MUST | core | - | A POPOVER display opens by its anchor; a POPOVER destroy closes it | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.main-tears-down` | MUST | core | - | A MAIN display takes the popup down; a popup displayed with it opens after it | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.app-change` | MUST | core | - | A response of another APP takes POPUP and POPOVER down | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.nest-processed` | MUST | core | - | A NEST / NEST2 display is processed without failing the roundtrip | [response.md#view-slots](../../spec/response.md#view-slots) |
| `slots.frontend-close` | MUST | core | - | The wired popup close (.eF VIEW_SLOTS destroy POPUP) closes it without a roundtrip | [actions.md#wired-frontend-actions](../../spec/actions.md#wired-frontend-actions) |
| `slots.popover-over-main` | MUST | core | - | A popover leaves MAIN on screen | [response.md#view-slots](../../spec/response.md#view-slots) |
| `action.order` | MUST | core | - | Follow-up actions run in the order of T_CUSTOM | [actions.md#follow-up-actions](../../spec/actions.md#follow-up-actions) |
| `action.after-render` | MUST | core | focus | Follow-up actions run after the views of the same response are built (SET_FOCUS finds its control) | [response.md#processing-order](../../spec/response.md#processing-order) |
| `action.unknown-skipped` | MUST | core | - | An unknown follow-up action is skipped; the ones after it run, the screen stays | [actions.md#follow-up-actions](../../spec/actions.md#follow-up-actions) |
| `action.unknown-reported` | SHOULD | core | - | An unknown follow-up action is reported (logged / listed as unsupported) | [actions.md#follow-up-actions](../../spec/actions.md#follow-up-actions) |
| `message.toast` | MUST | core | - | MESSAGE_TOAST show is shown with its text | [actions.md#messages](../../spec/actions.md#messages) |
| `message.box` | MUST | core | - | MESSAGE_BOX error is shown as a box with its text | [actions.md#messages](../../spec/actions.md#messages) |
| `message.box-close-event` | MUST | core | boxClose | Closing a box with onClose raises that event with the pressed action as first argument | [actions.md#messages](../../spec/actions.md#messages) |
| `message.details-sanitized` | MUST | core | dom | The HTML details of a message box are sanitized before rendering | [actions.md#messages](../../spec/actions.md#messages) |
| `router.keep` | MUST | core | url | Under KEEP routing the hash is #/app/<APP>/<ID> of the last response | [navigation.md#the-router-action](../../spec/navigation.md#the-router-action) |
| `router.hash-sent` | SHOULD | core | url | Requests carry the non-empty hash as HASH | [navigation.md#routes](../../spec/navigation.md#routes) |
| `router.back-restores` | MUST | core | url | Browser Back after a routed nav_app_call sends an app-start-shaped request with the caller's route | [navigation.md#routes](../../spec/navigation.md#routes) |
| `router.app-state` | MUST | core | url | setAppStateActive writes #/z2ui5-xapp-state=<ID>; a response without it clears it | [navigation.md#the-app-state-hash](../../spec/navigation.md#the-app-state-hash) |
| `error.shown` | MUST | core | - | A 500 answer is shown to the user (the backend's real error body) | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `error.as-text` | MUST | core | - | An error body is shown as text, verbatim - never interpreted as markup | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `error.empty-body` | MUST | core | - | An error without body is shown with its status (HTTP <status>) | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `error.app-start` | MUST | core | - | A failed app start is shown as an error, not as an empty screen | [errors.md#what-a-frontend-does-with-it](../../spec/errors.md#what-a-frontend-does-with-it) |
| `portable.default-aggregation` | MUST | portable | - | A default aggregation is accepted with and without its element | [portable.md#2-documents-slots-and-namespaces](../../profiles/portable.md#2-documents-slots-and-namespaces) |
| `portable.unknown-property` | MUST | portable | - | An unknown property of a known control is ignored | [portable.md#conformance](../../profiles/portable.md#conformance) |
| `portable.unknown-control` | MUST | portable | - | An element of an unknown control does not fail the view (a placeholder instead) | [portable.md#conformance](../../profiles/portable.md#conformance) |
| `portable.excluded-action` | MUST | portable | - | A follow-up action outside the portable list does not fail the response | [portable.md#6-frontend-actions](../../profiles/portable.md#6-frontend-actions) |
| `portable.box-details` | MUST | portable | dom | The details of a message box are shown | [portable.md#6-frontend-actions](../../profiles/portable.md#6-frontend-actions) |
| `portable.timer` | MUST | portable | timers | START_TIMER fires its event as an ordinary roundtrip after the delay | [actions.md#vocabulary](../../spec/actions.md#vocabulary) |
| `portable.set-title` | MUST | portable | title | SET_TITLE sets the document title | [portable.md#6-frontend-actions](../../profiles/portable.md#6-frontend-actions) |
| `portable.view-replaced` | MUST | portable | - | A second MAIN display replaces the first | [response.md#view_slots-display](../../spec/response.md#view_slots-display) |
| `ui5.wire-ebp` | MUST | ui5 | wires | A .eBP($event, true, ['EVENT'], arg) wire roundtrips like .eB | [ui5.md#event-wires](../../profiles/ui5.md#event-wires) |
| `ui5.wire-source-argument` | MUST | ui5 | wires | A ${$source>/prop} argument is resolved from the firing control | [ui5.md#event-wires](../../profiles/ui5.md#event-wires) |
| `ui5.wire-queue-last` | MUST | ui5 | wires, concurrent | A queue-last wire keeps its last firing during a roundtrip and sends it afterwards | [ui5.md#event-wires](../../profiles/ui5.md#event-wires) |
| `ui5.nest` | MUST | ui5 | nest | A NEST view is inserted into its anchor inside MAIN and destroyed again | [response.md#view-slots](../../spec/response.md#view-slots) |
| `semantic.snapshot-schema` | MUST | semantic | snapshot | Every snapshot matches schema/snapshot.schema.json | [semantic.md#snapshot-v1](../../profiles/semantic.md#snapshot-v1) |
| `semantic.recorded-snapshots` | SHOULD | semantic | snapshot | Replayed recorded traffic gives the recorded snapshots (traffic/node-runtime/agent-client.json) | [semantic.md#snapshot-v1](../../profiles/semantic.md#snapshot-v1) |
| `semantic.timer-action` | MUST | semantic | snapshot | START_TIMER is offered as an action with trigger timer | [semantic.md#actions](../../profiles/semantic.md#actions) |

<!-- checks:end -->
