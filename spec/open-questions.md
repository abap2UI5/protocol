# Open questions

Decisions this specification took provisionally - where the
implementations allowed more than one reading, or where the reading the
reference implements has a cost. Each entry names the decision, the
alternatives, and what it touches.

**Revision 0.3: the maintainer decided all ten.** Each entry now opens with
the decision and its rationale; the alternatives that were on the table
stay below it for the record. A new provisional decision is added here as
"Current decision" until it is decided the same way - question 11
(revision 0.4) and questions 12 and 13 (revision 0.5) are; question 14
is resolved, and question 15 was decided with protocol 3 (revision 0.6).
Question 2 was decided again in revision 0.7: the unchanged timer tick is
an exception to the new id.

The first five came out of the backend suite (revision 0.1,
[../conformance/RESULTS.md](../conformance/RESULTS.md)); the others out of
the frontend suite (revision 0.2).

| # | Question | Decided (0.3) |
|---:|---|---|
| 1 | NEST slots in portable renderers | (c) + (b): renderers tolerate them, portable apps must not use them |
| 2 | a new draft id in every response | (c) as it was; revision 0.7: resolved - an unchanged timer tick (`S_FRONT.TIMER`) MAY answer the id it continued, every other event keeps the rule - new check `session.timer-tick` |
| 3 | the request URL in the error body | (a) a backend MUST NOT reflect unvalidated request data - new check `error.no-reflection` |
| 4 | boolean event arguments for non-ABAP backends | (a) as it was |
| 5 | the detail of an app's error | (c) as it was |
| 6 | the UI5 frontend and the portable tolerance rule | (a) as it was |
| 7 | message box details | (a) shown expanded - the UI5 frontend is fixed |
| 8 | one roundtrip at a time for programs | (a) the client queues |
| 9 | `sap-contextid` for frontends without a browser | (a) MUST keep it |
| 10 | navigation actions in the portable action list | `portable-v1.json` separates `actions.api` from `actions.wire` |
| 11 | bound arguments (`${/PATH}`) of queued follow-up actions | open - current decision: recorded as what the UI5 frontend does, no rule |
| 12 | windowed tables as a part of the core protocol | open - current decision: core, and every conforming backend offers them |
| 13 | windowed tables in frontends that are not the UI5 frontend | open - current decision: they show the rows the app loaded and MAY ask for more; not in portable v1; snapshot v1 carries `total` and `window` (alternative (c), additive - the agent client implements it, still with the window request of 1.149.0) |
| 14 | tables behind a data reference in the backend suite | resolved: (b) a backend MUST read the `__delta` at `/<attr>/*` - app REF (and the windowed `MR_WIN` of the app WINDOW), checks `model.reference-delta`, `window.delta-rows-reference` |
| 15 | the app-driven window and the protocol number | decided (0.6): (b) protocol 3 - the number moved with the next breaking change of the wire, and the app-driven window is part of protocol 3 |

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

**Resolved (revision 0.7): (c) with one exception - the unchanged timer
tick.** A response to a request with `S_FRONT.TIMER: true`
([request.md](request.md#the-timer-tick)) whose app state the roundtrip
left unchanged MAY name the id the request continued, and the backend
writes no draft; for every other request - a click, a keystroke, a window
request, a tick that changed the app state - every 2xx response still
names a new id ([sessions.md](sessions.md#draft-ids), backend checks
`session.new-id`, `session.timer-tick`). abap2UI5 implements it on branch
`DEV` (`cdd2fb25`, [H] `main_end_reuse`; the frontend marks the tick from
`880ff0a5`); the maintainer approved it.

*Rationale.* A polling app - `START_TIMER` every two seconds - wrote a
draft of its whole state per tick and user: 1,800 rows an hour of a
screen on which nothing happened, and a chain that grew without end.
The tick is the one roundtrip the user did not ask for and the one that
repeats; for it, what the rule of revision 0.3 protects - that a frontend
sees whether *its user's* event changed anything - is not at stake, and
what the rule relies on holds all the same: a draft is a snapshot, so the
retry of a lost response, the browser history and an app-state link
continue an id that still names the state it named. Alternative (b) for
every event was rejected again: a click keeps its new id, so a frontend
keeps telling an event that changed something from one that did not.
Pruning the chain ([sessions.md](sessions.md#retention), revision 0.7) is
the other half of the draft volume and independent of this exception.

**Touches.** `spec/request.md` (`TIMER`, *The timer tick*),
`spec/sessions.md` (*Draft ids*), `schema/request.schema.json`; backend
check `session.timer-tick`, frontend check `request.timer-mark`.

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

*Status.* Fixed. abap2UI5 up to 1.146.0 reflected the URL verbatim and
failed the check, and so did cap2UI5, which hosts the same framework. From
1.147.0 on the URL is stripped to an allow-list ([H]
`context_info_url_safe`); the reference hosts (`@abap2ui5/node-runtime`
1.148.0, `@cap2ui5/cds-plugin` 0.5.0 on 1.147.0) pass, the pin in
`test/lib/expected.mjs` is gone. The history is in
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
`72c86cc` (`app/webapp/core/actions/ControlCall.js`, released with
1.147.0), which CI's frontend job runs; filed in
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
action - the others are folded by the backend into one options object,
the `ROUTER` system action of protocol 2 and `S_FRONT.NAV` of protocol 3
([actions.md](actions.md#vocabulary), [CL] `follow_up_action`, [FE]
`nav_serialize`). The file now carries both:

- `actions.api` - the `follow_up_action( )` names a portable app may call
  (`frontendActions.allowed` is the same list and stays, so consumers of
  revision 0.2 - the Web Components frontend copies the file - keep
  working; the change is additive and the profile stays version 1);
- `actions.wire` - what a renderer receives: the framework's part of the
  response (in the words of protocol 2, when this was decided: the system
  actions `VIEW_SLOTS` and `ROUTER` with its `routerOptions`), the names
  folded into those options (`foldedIntoRouter`), and the follow-up /
  `.eF` names (`custom`, `customGlobals`).

[../profiles/portable.md](../profiles/portable.md#6-frontend-actions)
renders the mapping from the file.

*Rationale.* A renderer reading the old list as follow-up action names
implemented five actions it never receives and could miss the navigation
options; an app author needs the client API's names. One list cannot serve
both.

**Alternatives considered.** (a) Rename the field to say it lists client
API calls; (b) list the wire actions and the navigation options
separately in v1.1.

**Touches.** `profiles/portable-v1.json` (`actions`),
`schema/portable-profile.schema.json`, `scripts/render-portable.mjs`,
`scripts/gen-portable-profile.mjs`, `profiles/portable.md` section 6.

## 11. Bound arguments of queued follow-up actions

**Current decision (revision 0.4): recorded, not a rule.** From abap2UI5
1.147.0 on the UI5 frontend resolves an argument of a queued follow-up
action that is spelled `${/PATH}` against the model before it runs the
action ([FA] `resolveBoundArgs`, [LIB] `bindingPathOf`;
[actions.md](actions.md#follow-up-actions)), so that
`follow_up_action( )` means the same from a handler as wired into a view,
where UI5 evaluates the binding. Before, every action received the text
`${/PATH}`. The specification describes it and requires nothing: no
frontend check, and the other frontends (the agent client, the two
renderers of this repository) pass such an argument on as text.

*Why it is open.* It changes what an action's arguments mean on the wire -
a text that used to be data is now a reference into `MODEL` - and an app
written against the UI5 frontend's behaviour shows `${/TITLE}` as a title
in a frontend that does not resolve it.

**Alternatives.**
- (a) Core rule: every frontend MUST resolve `${/PATH}` arguments of
  follow-up actions against the model of the slot the response filled -
  with a frontend check, and the portable renderers follow.
- (b) UI5 profile only: portable apps must not pass bound arguments (a
  linter rule), other frontends keep the text.
- (c) The backend resolves the value before it queues the action, and the
  wire carries data only - a change in abap2UI5 core.

**Touches.** `spec/actions.md`, `profiles/portable.md` section 6,
`conformance/frontend/lib/checks/`, `renderers/common/`.

## 12. Windowed tables as a part of the core protocol

**Current decision (revision 0.5): core, for every backend.** The window
state and the window request handed to the app as its event
([windowed-tables.md](windowed-tables.md)) are core rules with core checks
(`window.*`), and the conformance app WINDOW is one of the apps a
conforming backend serves ([core.md](core.md#conformance)). The reason: an
app is written once against the client API, and `window_bind_tab( )` has
to hand it the same requests and send the same rows and `TOTAL` on every
backend that runs it.

*Why it is open.* It makes a backend that was conformant at revision 0.4
non-conformant at 0.5 without a change of its own - twice over: the
window of abap2UI5 1.149.0 was replaced by the app-driven one on main
(`694fb262`) within days. The node-runtime host, on a runtime built from
that commit, passes every `window.*` check; on the released 1.150.0 it
cannot start the app WINDOW, nor can the cap2UI5 host
(`@cap2ui5/cds-plugin` 0.7.0, on the runtime 1.149.0) - both fail them,
pinned until the next release
([../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables)).
What a backend has to implement is smaller since the window is the app's:
it parses the request and hands it over, and sorts, filters and counts
nothing - a backend that is no port of the framework has no sort or
filter semantics to match any more.

**Alternatives.**
- (a) As decided: core.
- (b) A backend **capability**: a backend may not offer windowed tables;
  the suite reports `core` and `core + windowed tables`, and a frontend
  learns from the model alone whether a table is windowed (it already
  does). The checks stay as they are, behind the capability.
- (c) A profile of its own next to the view profiles - heavier than (b)
  for the same effect.

**Touches.** `spec/core.md` (conformance), `spec/windowed-tables.md`,
`conformance/backend/lib/runner.mjs` (profiles), `test/lib/expected.mjs`.

## 13. Windowed tables in frontends that are not the UI5 frontend

**Current decision (revision 0.5): they show the rows the app loaded;
asking for more is optional.** A frontend MUST adopt a model with
`/__WINDOW` and MUST send an edit as one of the row it shows
([windowed-tables.md](windowed-tables.md#frontends), frontend checks
`window.rows-shown`, `window.edit-row-shown`); it MAY send window
requests, in the shape of
[windowed-tables.md](windowed-tables.md#the-window-request). `window_bind_tab( )` is **not** part of the portable
profile v1. For the semantic profile the decision took alternative (c) as
an additive change of snapshot v1, after its implementation
([versioning.md](versioning.md#compatible-changes-within-protocol-3)
allows it, `snapshotVersion` stays 1): a windowed table carries `total`
and `window: { size, more? }`, `truncated` is true while rows are missing,
`app_act` takes `window` and a `BINDING_CALL` on such a table is the
action `@BINDING_CALL`
([../profiles/semantic.md](../profiles/semantic.md#windowed-tables)). The
keys are optional and sending a window request stays a MAY - (c) is what
the snapshot offers, not a duty of every semantic frontend.

*What the frontends do today* (measured,
[../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables)):
the Adaptive Cards and the terminal renderer of this repository show the
rows the app loaded as the whole table and send no window request. The
agent client (abap2UI5/mcp-server `8efb3d7` on, vendored `332a0b0`)
implements (c): its snapshot names `total` and how to load the next
window - but the window requests it sends are the ones of abap2UI5
1.149.0 and 1.150.0, which a backend with
the app-driven window hands to the app as an event named after a count
(`traffic/node-runtime/agent-client.json`; a finding of
[../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables)).
All three send a cell edit as a `__delta` of the row.

*Why it is open.* An app that binds 10,000 rows with a window of 100 is a
table of 100 rows in the portable renderers, without a word - the user of a
terminal cannot know that 9,900 rows are missing. The semantic snapshot no
longer hides it, but only as optional keys: whether a frontend that is not
the UI5 frontend MUST show that rows are missing, or MUST offer the next
window ((b) for the portable renderers, (c) made a duty for semantic
ones), is the maintainer's to decide.

**Alternatives.**
- (a) As decided.
- (b) Portable v1.1: a portable renderer MUST show that `TOTAL` exceeds
  `COUNT` and MUST offer a way to ask for the next window (`[path, event,
  "MORE", skip, top]`); sorting and filtering stay outside. A frontend check drives
  it. The two renderers of this repository follow.
- (c) Snapshot v2 (or an additive key in v1, which
  [versioning.md](versioning.md#compatible-changes-within-protocol-3)
  allows): a table carries `total` and an action that asks for more rows,
  so an agent can page. *Taken for the semantic profile as additive keys
  of v1 (revision 0.5, after the agent client of abap2UI5/mcp-server
  `8efb3d7`); the window request is `app_act { window }`, not an action
  in `actions`.*
- (d) The backend sends a table whole to a frontend that does not declare
  windows - a capability in `CONFIG`; a change in abap2UI5 core, and the
  size is what the app wanted to avoid.

**Touches.** `profiles/portable.md`, `profiles/portable-v1.json`,
`profiles/semantic.md`, `schema/snapshot.schema.json`,
`renderers/common/`, `conformance/frontend/lib/checks/window.mjs`.

## 14. Tables behind a data reference in the backend suite

**Resolved: (b).** A table bound through a data reference is the model
node `/<attr>/*`; its `__delta` goes on that node, and a backend MUST read
it there ([request.md](request.md#the-model-delta),
[windowed-tables.md](windowed-tables.md#edits)). The conformance app REF
(`Z2UI5_CL_CONF_REF`, with its cap2UI5 twin) binds an attribute
`TYPE REF TO data` with `_bind( )`, and the app WINDOW one with
`window_bind_tab( )` (`MR_WIN`, loaded by the app in an order of its own);
two backend checks hold the rule: `model.reference-delta` (the `__delta`
on `/MR_TAB/*` changes exactly the named cells) and
`window.delta-rows-reference` (on `/MR_WIN/*` its row keys are the rows of
the table - with the app-driven window no position is mapped). The
frontend rule keeps its check, renamed `window.edit-row-shown-reference`.
*Revision 0.5, the app-driven window:* until it, the windowed table behind
a reference was REF's (`MR_WIN`, bound with the `t_sort` of 1.149.0) and
its check `window.delta-positions-reference`; `window_bind_tab( )` of the
app-driven window does not compile against the released runtimes, so the
table moved to the app WINDOW and REF stays buildable on every runtime.

*Rationale.* A backend that looks for `__delta` at `/<attr>` only drops
every edit of such a table without an error, and before the app REF
nothing in the backend suite would have noticed.

*Status.* `@abap2ui5/node-runtime` 1.149.0 passed both checks: its
backend has read the `*` node all along ([MOD] `main_json_to_attri`) -
up to 1.149.0 only its frontend sent such an edit wrong, fixed in
abap2UI5 2cc0344 (#3026). `@cap2ui5/cds-plugin` 0.6.0 could not declare
a field `TYPE REF TO data` in a JavaScript app, so the twin's start
failed there and both checks were pinned for it; 0.7.0 brings the
plugin's `t.ref( )`, the host runs it, and the twin passed both checks
and answered them as the ABAP app
([../conformance/RESULTS.md](../conformance/RESULTS.md#tables-behind-a-data-reference)).
With the app-driven window `model.reference-delta` still passes on both
hosts; `window.delta-rows-reference` passes on a runtime of abap2UI5 main
`694fb262` and is pinned, with the other window checks, for the released
hosts, which cannot start the app WINDOW.

**Alternatives considered.**
- (a) A frontend rule with a check, a backend note without one (the
  decision until this revision).
- (b) A backend MUST: a `TYPE REF TO data` table in a conformance app -
  windowed and not - with the cap2UI5 twin, a check `model.reference-delta`
  (and `window.delta-positions` behind a reference), traffic recorded again
  from both hosts.

**Touches.** `spec/request.md`, `spec/windowed-tables.md`,
`conformance/apps/`, `conformance/backend/lib/checks/model.mjs`,
`traffic/`.

## 15. The app-driven window and the protocol number

**Decided (revision 0.6): (b), protocol 3.** The maintainer broke the wire
on 2026-11-22 - the response sections `VIEWS`, `NAV` and `ACTIONS`, the
parsed `ROUTE`, the options object of an event wire
([versioning.md](versioning.md#what-protocol-3-broke)) - and raised
`c_protocol` and the frontend's `PROTOCOL` to 3 with it ([TY], [SRV];
abap2UI5 `DEV`). No release had shipped the app-driven window under
protocol 2 with a number of its own, so it is part of protocol 3 from its
first day: a frontend of 1.149.0 or 1.150.0 refuses the responses of a
protocol-3 backend on the number, and the two no longer misread each
other's window requests.

*Rationale.* The rule of [versioning.md](versioning.md#compatible-changes-within-protocol-3)
asked for a new number; what stood against it was the cost of moving every
frontend for one reserved event. That cost is paid by the other breaks of
protocol 3 anyway.

*What stays of the question.* Between abap2UI5 main `694fb262` (#3032) and
the first release with protocol 3, a build of main declares protocol 2
with the app-driven window. Such a build paired with a frontend or a
backend of 1.149.0 or 1.150.0 misreads window requests as described below;
no release is in that state.

**What was asked (revision 0.5).** abap2UI5 after 1.150.0 (main
`694fb262`, #3032) replaced the windowed table of 1.149.0 by an
app-driven one ([windowed-tables.md](windowed-tables.md)): the arguments
of `___ZZZ_WIN` are `[path, event, reason, skip, top, sort?, filter?]` and
run the app, where they were `[path, count, sort?, filter?]` answered by
the backend; the rows of a `__delta` on a windowed table are rows of the
table, where they were positions in the backend's order; a whole table
value is written, where it was refused; `__WINDOW` carries `EVENT`. By the
rule - "changing a key's type or meaning" - that breaks the wire. abap2UI5
main kept `c_protocol` and the frontend's `PROTOCOL` at 2, and revision
0.5 followed it: the window of 1.149.0 was public for a few days (released
2026-11-16), a frontend and a backend of abap2UI5 ship together, and the
one frontend outside the framework that sends window requests, the agent
client, is pinned as a finding
([../conformance/RESULTS.md](../conformance/RESULTS.md#windowed-tables)).
A pinned webapp of 1.149.0 against a newer backend, or a newer frontend
against a backend of 1.149.0, misread each other's window requests
without an error - the app sees an event named after a count and loads
nothing, or the backend reads the app's event name as a count and answers
one window of its own order.

**Alternatives considered.**
- (a) Protocol 2 stays, and the window of 1.149.0 is recorded as
  withdrawn - the decision of revision 0.5.
- (b) Protocol 3 with the release that ships the app-driven window - both
  halves raised, as the rule asks; a frontend of 1.149.0 then refuses the
  newer backend's responses, and every non-UI5 frontend has to move too.
  **Decided.**
- (c) Protocol 2, and the reserved event renamed (for example
  `___ZZZ_WIN2`), so that a backend of either age refuses or ignores the
  other's requests instead of misreading them - no number moves, the
  misreading becomes an unknown event.

**Touches.** abap2UI5 `c_protocol` and the frontend's `PROTOCOL`,
`spec/versioning.md`, `schema/request.schema.json`, every frontend that
sends window requests.
