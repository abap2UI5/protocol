# Open questions

Decisions this specification took provisionally - where the
implementations allowed more than one reading, or where the reading the
reference implements has a cost. Each entry names the decision, the
alternatives, and what it touches.

**Revision 0.3: the maintainer decided all ten.** Each entry now opens with
the decision and its rationale; the alternatives that were on the table
stay below it for the record. A new provisional decision is added here as
"Current decision" until it is decided the same way.

The first five came out of the backend suite (revision 0.1,
[../conformance/RESULTS.md](../conformance/RESULTS.md)); the others out of
the frontend suite (revision 0.2).

| # | Question | Decided (0.3) |
|---:|---|---|
| 1 | NEST slots in portable renderers | (c) + (b): renderers tolerate them, portable apps must not use them |
| 2 | a new draft id in every response | (c) as it was |
| 3 | the request URL in the error body | (a) a backend MUST NOT reflect unvalidated request data - new check `error.no-reflection` |
| 4 | boolean event arguments for non-ABAP backends | (a) as it was |
| 5 | the detail of an app's error | (c) as it was |
| 6 | the UI5 frontend and the portable tolerance rule | (a) as it was |
| 7 | message box details | (a) shown expanded - the UI5 frontend is fixed |
| 8 | one roundtrip at a time for programs | (a) the client queues |
| 9 | `sap-contextid` for frontends without a browser | (a) MUST keep it |
| 10 | navigation actions in the portable action list | `portable-v1.json` separates `actions.api` from `actions.wire` |

## 1. The NEST slots in portable renderers

**Decided (revision 0.3): (c) + (b).** NEST and NEST2 stay outside
portable profile v1, and the two sides get separate rules
([../profiles/portable.md](../profiles/portable.md#2-documents-slots-and-namespaces)):

- a portable **renderer** tolerates them - it MAY show a placeholder for a
  NEST/NEST2 display, but MUST process the action without failing the
  roundtrip ([response.md](response.md#view-slots); frontend check
  `slots.nest-processed`, every frontend; `ui5.nest`, the UI5 profile
  renders them);
- a portable **app** MUST NOT use them: `nest_view_display` /
  `nest2_view_display` and their destroys are outside the portable client
  API, and the abap2UI5 linter's portable rule reports the calls.

*Rationale.* 6 of 247 core apps use them; mapping the anchor's insert
method (`addItem`, `addContent`, ...) per container is a cost every
renderer would pay for a handful of apps. Excluding them at authoring time
makes the limit visible where it is cheap to act on, and the renderer
tolerance keeps a stray NEST display from breaking a session.

**Alternatives considered.**
- (a) Put NEST/NEST2 into the portable profile: every portable renderer
  inserts the view into its anchor (`id`, `methodInsert`) - cheap for a DOM
  renderer, the anchor's insert method has to be mapped per container.
- (b) Exclude them from portable *apps* (a linter rule) and keep the
  frontend tolerance as it is.
- (c) Tolerated, not rendered.

**Touches.** `profiles/portable.md` section 2; the abap2UI5 linter (its
portable rule); `portable-v1.json` is unchanged (`slots.notInV1`,
`clientApi.excluded` already said so).

## 2. A new draft id in every response

**Decided (revision 0.3): (c), as it was.** Every 2xx response MUST name a
draft id different from the one its request continued
([sessions.md](sessions.md#draft-ids), backend checks `session.new-id`,
`session.continuation`). A draft id is not unique within a session, though:
a return to a stacked app answers the id the caller was saved under, so two
leaves to the same caller answer the same id (implementation note there). A
frontend MUST NOT assume uniqueness; the frontend suite's
`request.id-continuation` answers an id seen before and requires it to be
continued like any other.

*Rationale.* Unique ids would cost a draft write per leave and change what
Back restores; dropping the MUST would save a write per no-op event but
make "did this event change anything" invisible to a frontend. The rule
that matters for frontends - continue the id adopted last, whatever it is -
holds either way.

**Alternatives considered.**
- (a) Unique ids: a leave saves the restored caller under a fresh id (one
  more draft write per leave; Back through a route would then restore a
  copy rather than the saved state).
- (b) Drop the MUST: a roundtrip that changed nothing may answer the same id
  (saves a draft write per no-op event; a retry and browser history keep
  working because drafts are snapshots).
- (c) As it was.

**Touches.** Nothing changed.

## 3. The request URL reflected into the error body

**Decided (revision 0.3): (a).** A backend MUST NOT reflect request data it
did not validate into the error body: what it repeats from the request -
the URL, the class name, an event name - is first reduced to characters
that cannot be read as markup, as the reference already does for the class
name ([errors.md](errors.md#the-error-response), [ACT] `app_start_safe`).
New backend check `error.no-reflection` (MUST): an app start that fails,
with `<script>`, `<img>` and quotes in its URL - the error body must not
contain them verbatim.

*Rationale.* `text/plain` + `nosniff` and a frontend that shows the body as
text (frontend check `error.as-text`) keep the body harmless on screen, but
an error body travels further than the screen - into logs, tickets, mails
and tools that do not read headers. Escaping (b) would show `&lt;` to the
reader of a plain-text body; stripping to safe characters keeps a real typo
readable.

*Status.* abap2UI5 1.146.0 - the release both reference hosts run -
reflects the URL verbatim ([H] `request_context_info`) and fails the check,
and so does cap2UI5, which hosts the same framework. The fix (strip the URL
like the class name) is made in abap2UI5 core and reaches cap2UI5 with the
runtime; until a release carries it the failure is pinned in
`test/lib/expected.mjs` and recorded in
[../conformance/RESULTS.md](../conformance/RESULTS.md).

**Alternatives considered.**
- (a) A backend MUST NOT reflect request data it did not validate (strip
  the URL to name characters, as the class name already is).
- (b) A backend MUST escape it (but the body is not HTML - escaping would
  show `&lt;` to the reader).
- (c) As it was: reflected verbatim, safe through the headers and the
  frontend rule.

**Touches.** `spec/errors.md`; backend check `error.no-reflection`; [H]
`request_context_info` (abap2UI5), and cap2UI5 through its runtime.

## 4. Boolean event arguments for backends that are not ABAP

**Decided (revision 0.3): (a), as it was.** The frontend sends every
argument as the raw JSON value (`true` stays `true`,
[request.md](request.md#event-arguments), frontend check
`request.event-arguments`); the backend hands every argument to the app as
a string, `true` as `X`, `false` and `null` as the empty string - normative
for every backend (backend check `event.argument-conversion`). A JavaScript
app on cap2UI5 sees `"X"` too, because cap2UI5 hosts the transpiled
framework.

*Rationale.* One app-visible convention everywhere: an app ports between
backends unchanged, and the wire stays typed for whoever wants the JSON.

**Alternatives considered.**
- (a) One app-visible convention, ABAP's, everywhere; apps port between
  backends unchanged.
- (b) The conversion is ABAP's only: a backend whose apps are not ABAP hands
  them the JSON values (`get_event_arg` returns `true`); the wire stays as
  it is, the app API differs per backend.
- (c) A typed accessor next to the string one (`get_event_arg_json( n )`)
  on every backend; the string conversion stays for compatibility.

**Touches.** Nothing changed.

## 5. The detail of an app's error

**Decided (revision 0.3): (c), as it was.** The error body is for a human
and not normative; a backend SHOULD name the failure the app raised and MAY
hide every detail on purpose ([errors.md](errors.md#the-error-response),
backend check `error.details`, a warning on cap2UI5, which answers a
JavaScript app's `throw` with `roundtrip failed (<correlation id>)` while
the framework's own errors on the same route keep their full body).

*Rationale.* Hiding details is a legitimate installation choice (the
reference's `check_hide_error_details`); a SHOULD keeps the developer's
diagnostic the default without making a masking host non-conformant.

**Alternatives considered.**
- (a) MUST name the failure unless the installation switched details off
  (the reference's `check_hide_error_details`) - cap2UI5 would then need a
  project setting.
- (b) MUST carry a correlation id the server log can be searched for, with
  or without details.
- (c) As it was.

**Touches.** Nothing changed.

## 6. The UI5 frontend and the portable tolerance rule

**Decided (revision 0.3): (a), as it was** (the reading revision 0.2
took). A portable frontend MUST NOT fail on anything outside the profile -
an unknown control becomes a placeholder. The UI5 frontend renders every
portable app, but it does not follow that rule: an element it cannot load
fails the view with the fatal overlay (the frontend suite's
`portable.unknown-control`, run against the UI5 SPA: `ModuleError: failed
to load 'com/example/conformance/Gadget.js'`). The tolerance rule binds the
renderers that are not UI5 frontends
([../profiles/portable.md](../profiles/portable.md#conformance)), and the
check skips a UI5-profile frontend.

*Rationale.* In the UI5 profile every UI5 element is vocabulary; a module
that does not load is a broken view (a typo, a missing SAPUI5 library), and
the hint the frontend shows for it is worth more than a placeholder.

**Alternatives considered.**
- (a) As it was.
- (b) The UI5 frontend catches a failed module load of an unknown namespace
  and renders a placeholder (a frontend change; it would also hide typos
  and the missing-SAPUI5-library hint the frontend shows today).

**Touches.** Nothing changed.

## 7. Message box details: shown, or behind a link

**Decided (revision 0.3): (a), expanded.** A frontend that renders message
boxes MUST show the `details` with the box - the UI5 frontend expands them
on purpose ([actions.md](actions.md#messages), [CC] `expandBoxDetails`;
frontend check `portable.box-details`). The check fails a frontend that
keeps them behind a "details" link.

*Rationale.* What `message_box_display( )` renders out of a table or a
structure *is* the message; behind a link it is easily never seen.

*Status.* On OpenUI5 1.144 (and every release whose `sap.m.MessageBox`
fills the details text only when its "View Details" link is pressed - 1.120
does, 1.71 set it at creation) the UI5 frontend shows **no** details at
all: `expandBoxDetails` makes the still-empty `FormattedText` visible and
hides the link that would have filled it. Fixed on abap2UI5's main in
`72c86cc` (`app/webapp/core/actions/ControlCall.js`, after 1.146.0), which
CI's frontend job runs; filed in
[../conformance/RESULTS.md](../conformance/RESULTS.md#frontend-suite).

**Alternatives considered.**
- (a) Expanded.
- (b) Reachable is enough: shown, or behind a control of the box that
  reveals them - the check would accept a link.

**Touches.** `spec/actions.md` (wording); the UI5 frontend.

## 8. One roundtrip at a time for frontends driven by a program

**Decided (revision 0.3): (a), the client queues.** "A user event"
includes a call of a program that drives the frontend: an agent client
MUST NOT start a second roundtrip on a session while one is in flight; it
SHOULD queue the call and start it once the response is adopted, and MAY
refuse it ([transport.md](transport.md#client-behaviour), frontend check
`transport.one-at-a-time`). The agent client of abap2UI5/mcp-server posted
both (two `act` calls on one session, each continuing the same draft) up to
`ea4e9fa`; since `a4d9f07` it queues.

*Rationale.* Overlapping requests continue the same draft and the later
answer silently drops what the earlier one did; a queue keeps both effects
in order at the cost of latency only.

**Alternatives considered.**
- (a) The client queues or refuses the second call.
- (b) Overlapping requests are allowed for programmatic frontends and
  resolved last-wins (drafts are snapshots, so nothing breaks on the
  backend - but the earlier request's effect is silently lost).

**Touches.** `spec/transport.md` (the queue); the agent client.

## 9. Stateful sessions and frontends without a browser

**Decided (revision 0.3): (a), MUST keep it.** Every frontend that talks
HTTP MUST keep the last `sap-contextid` response header and send it back
([transport.md](transport.md#stateful-sessions-sap-contextid), frontend check
`transport.contextid-kept`). The agent client did not up to `ea4e9fa` -
against an ABAP app that switched to a stateful session it would have
talked to a fresh work process on every act; since `a4d9f07` it keeps it.

*Rationale.* Whether an app is stateful is the app's business, not the
frontend's; an agent-operable app should not have to be a stateless one.
Keeping a header is cheap for every client.

**Alternatives considered.**
- (a) MUST keep it.
- (b) Stateful sessions are a UI5-profile feature: a frontend outside it MAY
  ignore `sap-contextid`, and apps that need a stateful session are not
  agent-operable.

**Touches.** Nothing changed in the spec; the agent client.

## 10. Navigation actions in the portable action list

**Decided (revision 0.3): separate the two lists.** `portable-v1.json`
used to list `SET_PUSH_STATE`, `HASH_REPLACE`, `HASH_BACK`,
`HASH_ATTACH_CHANGED`, `SET_NAV_ROUTING` and `SET_APP_STATE_ACTIVE` among
the allowed frontend actions, but only `HASH_BACK` travels as a follow-up
action - the others are folded into the one `ROUTER` system action by the
backend ([actions.md](actions.md#vocabulary), [CL] `follow_up_action`, [FE]
`check_on_event`). The file now carries both:

- `actions.api` - the `follow_up_action( )` names a portable app may call
  (`frontendActions.allowed` is the same list and stays, so consumers of
  revision 0.2 - the Web Components frontend copies the file - keep
  working; the change is additive and the profile stays version 1);
- `actions.wire` - what a renderer receives: the system actions
  (`VIEW_SLOTS`, `ROUTER` with its `routerOptions`), the names folded into
  `ROUTER` (`foldedIntoRouter`), and the `T_CUSTOM` / `.eF` names
  (`custom`, `customGlobals`).

[../profiles/portable.md](../profiles/portable.md#6-frontend-actions)
renders the mapping from the file.

*Rationale.* A renderer reading the old list as `T_CUSTOM` names
implemented five actions it never receives and could miss the `ROUTER`
options; an app author needs the client API's names. One list cannot serve
both.

**Alternatives considered.** (a) Rename the field to say it lists client
API calls; (b) list the wire actions and the `ROUTER` options separately
in v1.1.

**Touches.** `profiles/portable-v1.json` (`actions`),
`schema/portable-profile.schema.json`, `scripts/render-portable.mjs`,
`scripts/gen-portable-profile.mjs`, `profiles/portable.md` section 6.
