# Open questions

Decisions this specification took provisionally - where the
implementations allowed more than one reading, or where the reading the
reference implements has a cost. Each entry names the **current
decision** (what the spec and the suites say today), the alternatives, and
what a change would touch. A maintainer decides; until then the current
decision is normative.

The first five came out of the backend suite (revision 0.1,
[../conformance/RESULTS.md](../conformance/RESULTS.md)); the others out of
the frontend suite.

## 1. The NEST slots in portable renderers

**Current decision.** NEST and NEST2 are not in portable profile v1 (6 of
247 core apps use them). A portable renderer that receives a NEST/NEST2
display MAY show a placeholder, but MUST process the action without failing
the roundtrip ([../profiles/portable.md](../profiles/portable.md#2-documents-slots-and-namespaces),
[response.md](response.md#view-slots)). Checked by the frontend suite's
`slots.nest-processed` (core, every frontend) and `ui5.nest` (the UI5
profile renders them).

**Alternatives.**
- (a) Put NEST/NEST2 into the portable profile: every portable renderer
  inserts the view into its anchor (`id`, `methodInsert`) - cheap for a DOM
  renderer, the anchor's insert method has to be mapped per container.
- (b) Exclude them from portable *apps* (a linter rule) and keep the
  frontend tolerance as it is.
- (c) As now: tolerated, not rendered.

**Touches.** `profiles/portable.md` section 2 and 9, `portable-v1.json`
(`slots`), the census; the frontend suite would turn `ui5.nest` into a
portable check.

## 2. A new draft id in every response

**Current decision.** Every 2xx response MUST name a draft id different
from the one its request continued ([sessions.md](sessions.md#draft-ids),
backend checks `session.new-id`, `session.continuation`). A draft id is not
unique within a session, though: a return to a stacked app answers the id
the caller was saved under, so two leaves to the same caller answer the
same id (implementation note there). A frontend MUST NOT assume uniqueness;
the frontend suite's `request.id-continuation` answers an id seen before
and requires it to be continued like any other.

**Alternatives.**
- (a) Unique ids: a leave saves the restored caller under a fresh id (one
  more draft write per leave; Back through a route would then restore a
  copy rather than the saved state).
- (b) Drop the MUST: a roundtrip that changed nothing may answer the same id
  (saves a draft write per no-op event; a retry and browser history keep
  working because drafts are snapshots).
- (c) As now.

**Touches.** `spec/sessions.md`; backend checks `session.new-id`,
`session.continuation`; [ACT] `prepare_app_stack` for (a), [H]
`main_end_save` for (b).

## 3. The request URL reflected into the error body

**Current decision.** The reference writes the request URL unescaped into
the first frame of its 500 body ([H] `request_context_info`) - an
implementation note. It is safe because the body is `text/plain` with
`nosniff` (both SHOULD, backend check `error.not-sniffable`) and because a
frontend MUST show the body as text, verbatim, never as markup
([errors.md](errors.md#what-a-frontend-does-with-it), frontend check
`error.as-text`).

**Alternatives.**
- (a) A backend MUST NOT reflect request data it did not validate (strip
  the URL to name characters, as the class name already is).
- (b) A backend MUST escape it (but the body is not HTML - escaping would
  show `&lt;` to the reader).
- (c) As now.

**Touches.** `spec/errors.md`; a backend check for (a); [H]
`request_context_info`.

## 4. Boolean event arguments for backends that are not ABAP

**Current decision.** The frontend sends every argument as the raw JSON
value (`true` stays `true`, [request.md](request.md#event-arguments),
frontend check `request.event-arguments`); the backend hands every argument
to the app as a string, `true` as `X`, `false` and `null` as the empty
string - normative for every backend (backend check
`event.argument-conversion`). A JavaScript app on cap2UI5 sees `"X"` too,
because cap2UI5 hosts the transpiled framework.

**Alternatives.**
- (a) As now: one app-visible convention, ABAP's, everywhere; apps port
  between backends unchanged.
- (b) The conversion is ABAP's only: a backend whose apps are not ABAP hands
  them the JSON values (`get_event_arg` returns `true`); the wire stays as
  it is, the app API differs per backend.
- (c) A typed accessor next to the string one (`get_event_arg_json( n )`)
  on every backend; the string conversion stays for compatibility.

**Touches.** `spec/request.md`; backend check `event.argument-conversion`;
the client API of cap2UI5 ([CAP] `get_event_arg`).

## 5. The detail of an app's error

**Current decision.** The error body is for a human and not normative; a
backend SHOULD name the failure the app raised and MAY hide every detail on
purpose ([errors.md](errors.md#the-error-response), backend check
`error.details`, a warning on cap2UI5, which answers a JavaScript app's
`throw` with `roundtrip failed (<correlation id>)` while the framework's own
errors on the same route keep their full body).

**Alternatives.**
- (a) MUST name the failure unless the installation switched details off
  (the reference's `check_hide_error_details`) - cap2UI5 would then need a
  project setting.
- (b) MUST carry a correlation id the server log can be searched for, with
  or without details.
- (c) As now.

**Touches.** `spec/errors.md`; backend check `error.details` (level);
cap2UI5 `plugin/cds-plugin.js` `roundtrip`.

## 6. The UI5 frontend and the portable tolerance rule

**Current decision** (taken in this revision). A portable frontend MUST NOT
fail on anything outside the profile - an unknown control becomes a
placeholder. The UI5 frontend renders every portable app, but it does not
follow that rule: an element it cannot load fails the view with the fatal
overlay (the frontend suite's `portable.unknown-control`, run against the
UI5 SPA: `ModuleError: failed to load 'com/example/conformance/Gadget.js'`).
The spec used to call the UI5 frontend "a portable frontend by
construction"; it now binds the tolerance rule to renderers that are not
UI5 frontends ([../profiles/portable.md](../profiles/portable.md#conformance)),
and the check skips a UI5-profile frontend.

**Alternatives.**
- (a) As now.
- (b) The UI5 frontend catches a failed module load of an unknown namespace
  and renders a placeholder (a frontend change; it would also hide typos
  and the missing-SAPUI5-library hint the frontend shows today).

## 7. Message box details: shown, or behind a link

**Current decision** (this revision). A frontend that renders message
boxes MUST show the `details` with the box - the UI5 frontend expands them
on purpose ([actions.md](actions.md#messages), [CC] `expandBoxDetails`;
frontend check `portable.box-details`). The check fails a frontend that
keeps them behind a "details" link.

Found on the way: on OpenUI5 1.144 (and every release whose
`sap.m.MessageBox` fills the details text only when its "View Details" link
is pressed - 1.120 does, 1.71 set it at creation) the UI5 frontend shows
**no** details at all: `expandBoxDetails` makes the still-empty
`FormattedText` visible and hides the link that would have filled it. Filed
in [../conformance/RESULTS.md](../conformance/RESULTS.md#frontend-suite).

**Alternatives.**
- (a) As now (expanded).
- (b) Reachable is enough: shown, or behind a control of the box that
  reveals them - the check would accept a link.

## 8. One roundtrip at a time for frontends driven by a program

**Current decision** (this revision). "A user event" includes a call of a
program that drives the frontend: an agent client MUST NOT start a second
roundtrip on a session while one is in flight
([transport.md](transport.md#client-behaviour), frontend check
`transport.one-at-a-time`). The agent client of abap2UI5/mcp-server posts
both (two `act` calls on one session), each continuing the same draft.

**Alternatives.**
- (a) As now: the client queues or refuses the second call.
- (b) Overlapping requests are allowed for programmatic frontends and
  resolved last-wins (drafts are snapshots, so nothing breaks on the
  backend - but the earlier request's effect is silently lost).

## 9. Stateful sessions and frontends without a browser

**Current decision.** Every frontend that talks HTTP MUST keep the last
`sap-contextid` response header and send it back
([transport.md](transport.md#stateful-sessions-sap-contextid), frontend check
`transport.contextid-kept`). The agent client does not; against an ABAP app
that switched to a stateful session it would talk to a fresh work process
on every act.

**Alternatives.**
- (a) As now.
- (b) Stateful sessions are a UI5-profile feature: a frontend outside it MAY
  ignore `sap-contextid`, and apps that need a stateful session are not
  agent-operable.

## 10. Navigation actions in the portable action list

**Observation** (no decision taken). `portable-v1.json` lists
`SET_PUSH_STATE`, `HASH_REPLACE`, `HASH_BACK`, `HASH_ATTACH_CHANGED`,
`SET_NAV_ROUTING` and `SET_APP_STATE_ACTIVE` as allowed frontend actions,
but only `HASH_BACK` travels as a follow-up action - the others are folded
into the one `ROUTER` system action by the backend
([actions.md](actions.md#vocabulary)). The list is the client API's names
(what a portable app may call), not the wire's; a renderer reading it as a
list of `T_CUSTOM` names implements five actions it never receives and may
miss the `ROUTER` options.

**Alternatives.** (a) Rename the field to say it lists client API calls;
(b) list the wire actions and the `ROUTER` options separately in v1.1.
