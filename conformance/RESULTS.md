# Results

Backend suite, profile `ui5` (76 checks: 69 core, 7 UI5-profile; 62 MUST,
14 SHOULD), run 2026-10-03 with `npm run conformance:<backend>`. The traffic
of these runs is recorded in [`../traffic/`](../traffic/). Revision 0.3 added
`error.no-reflection` (MUST, [open question 3](../spec/open-questions.md#3-the-request-url-reflected-into-the-error-body));
both reference backends fail it - see [below](#the-request-url-reflected-into-the-error-body).

| Backend | Version | Apps | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| `node-runtime` | `@abap2ui5/node-runtime` 1.146.0 (abap2UI5 1.146.0, transpiled) | the ABAP apps, transpiled with `@abaplint/transpiler-cli` 2.13.93 | 75 | 1 | 0 | 0 | one MUST failed: `error.no-reflection` (fix in abap2UI5 core, pinned) |
| `cap2ui5` | `@cap2ui5/cds-plugin` 0.4.0 on `@abap2ui5/node-runtime` 1.146.0, `@sap/cds` 10 | the JavaScript apps | 74 | 1 | 1 | 0 | one MUST failed: `error.no-reflection` (inherited from the runtime, pinned) |

Per area (both backends identical except `errors`):

| Area | Checks | node-runtime | cap2ui5 |
|---|---:|---|---|
| transport | 8 | 8 pass | 8 pass |
| response | 8 | 8 pass | 8 pass |
| event | 5 | 5 pass | 5 pass |
| model | 10 | 10 pass | 10 pass |
| message | 4 | 4 pass | 4 pass |
| slots | 7 | 7 pass | 7 pass |
| action | 3 | 3 pass | 3 pass |
| nav / route | 14 | 14 pass | 14 pass |
| session | 5 | 5 pass | 5 pass |
| error | 5 | 4 pass, 1 fail (`error.no-reflection`) | 3 pass, 1 fail (`error.no-reflection`), 1 warn (`error.details`) |
| ui5 | 7 | 7 pass | 7 pass |

The ABAP system itself (abap2UI5 on NetWeaver / ABAP Cloud) has not been run
yet - it needs a system with the apps pulled in by abapGit; the transpiled
runtime is the same framework source.

## The request URL reflected into the error body

`error.no-reflection` (MUST since revision 0.3) starts an unknown app with
`<script>`, `<img>` and quotes in the request URL and requires the 500 body
not to contain them verbatim. Both reference backends fail it, identically:

```
Request failed, no event (initial rendering), app_start Z2UI5_CL_CONF_DOES_NOT_EXIST,
url /?app_start=Z2UI5_CL_CONF_DOES_NOT_EXIST&conformance=<script>alert("conformance-probe")</script><img src='conf...
```

The class name is stripped to name characters ([ACT] `app_start_safe`),
the URL is not (abap2UI5 1.146.0, [H] `request_context_info`). *The
backend is wrong* (the maintainer's decision on
[open question 3](../spec/open-questions.md#3-the-request-url-reflected-into-the-error-body)):
the fix strips the URL like the class name and is made in abap2UI5 core
(`ed8115b` "Strip the request URL to safe characters in the 500 body", on
its working branch on 2026-10-03); cap2UI5 hosts the same framework and
gets it with the runtime. Until both
reference hosts run a release with the fix, the failure is pinned in
[`../test/lib/expected.mjs`](../test/lib/expected.mjs) (the tests fail
when it starts to pass, so the pin is removed with the bump) and the
recorded traffic carries it (`counts.fail` 1 on both).

## Differences between the two backends

`test/traffic.test.mjs` compares the two recordings check by check - status,
media type and JSON body, draft ids normalized - and finds them
**identical** apart from the following. Both are the same framework
(cap2UI5 hosts `@abap2ui5/node-runtime` rather than porting it), so this
was the expected outcome; what differs is what the host adds around it.

1. **Error body of a JavaScript app's exception** - *filed difference,
   within the spec.* A `throw` in a cap2UI5 JavaScript app is no ABAP
   exception: it passes the framework's `CATCH cx_root` and reaches the
   plugin's own catch, which answers `500 text/plain` with
   `roundtrip failed (<correlation id>)` and logs the cause server-side
   (cap2UI5 `plugin/cds-plugin.js`, `roundtrip`). Status, media type and the
   draft handling are the framework's (`error.app-exception`,
   `session.failed-roundtrip-not-persisted` pass); only the body text names
   nothing, so `error.details` (SHOULD) warns.
   *Spec decision:* the content of an error body is not normative
   ([../spec/errors.md](../spec/errors.md#the-error-response)); naming the
   failure is a SHOULD with "MAY hide details on purpose", which is exactly
   the reference's own `check_hide_error_details`. *Filed for cap2UI5:* the
   masking is deliberate (no reconnaissance for clients), but it differs from
   the framework's errors on the same route (an unknown draft shows the
   framework's full body) - a project setting, or the user exit's
   `check_hide_error_details`, could decide both the same way.
2. **`Content-Type` charset spelling of that body** - `text/plain;
   charset=utf-8` (cap2UI5, express) vs `text/plain; charset=UTF-8`
   (framework). Media types are case-insensitive in their parameters; not a
   difference the spec cares about.

## Spec decisions taken while running the suite

Places where the implementations made a choice the specification now
records - as a rule, or as an implementation note:

- **Only bound attributes are the model.** The called app's `MODEL` holds
  `INPUT`/`OUTPUT`, not the unbound `HAS_PREV` - normative
  ([../spec/response.md](../spec/response.md#model)).
- **An app that binds nothing sends no `MODEL`, even with a display** -
  normative exception to "a display carries the model".
- **Draft ids repeat after `nav_app_leave`.** Leaving twice to the same
  caller answered the same id twice - implementation note; a frontend must
  not assume uniqueness ([../spec/sessions.md](../spec/sessions.md#draft-ids)).
- **An earlier draft id continues from its own snapshot** - normative
  (retry safety, [../spec/sessions.md](../spec/sessions.md#drafts-are-snapshots)).
- **Unknown draft on an event = error; on a route = fresh start + toast** -
  normative, both behaviours of the reference.
- **The request URL is reflected unescaped into the 500 body** - recorded
  as an implementation note in revision 0.1 (safe only as `text/plain` +
  `nosniff` + a frontend that renders text); since revision 0.3 a backend
  MUST NOT reflect unvalidated request data (`error.no-reflection`, above;
  [../spec/errors.md](../spec/errors.md#the-error-response)).
- **`DEFAULT` routing mode on every hop to an app without a mode** -
  normative ([../spec/navigation.md](../spec/navigation.md#the-router-action)).
- **Event argument conversion** (`true` -> `X`, `null`/`false` -> empty,
  objects -> compact JSON text) - normative, the same on both backends.

## Frontend suite

Frontend suite, 81 checks (66 MUST, 15 SHOULD; 66 core, 8 portable, 4 UI5,
3 semantic), run 2026-10-03 with
`abap2ui5-conformance frontend --adapter <name>` (each frontend at its
widest profile). The scripted backend answers from
[`../traffic/node-runtime/`](../traffic/node-runtime/) plus synthetic edge
cases. A skip is no verdict: outside the profile, a capability the
frontend does not have (a URL, a DOM, timers), or an interaction it cannot
perform.

| Frontend | Version | Profile | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| UI5 SPA (`ui5`) | abap2UI5 1.146.0 `b812079` `app/webapp` (identical at main `5d7e91f`, which CI pins), OpenUI5 1.144.0 (npm), Chromium 141 | ui5 | 76 | 1 | 0 | 4 | one MUST deviation: `portable.box-details` |
| agent client (`agent`) | abap2UI5/mcp-server `lib/appclient.mjs` @ `ea4e9fa` (vendored) | semantic | 53 | 5 | 3 | 20 | not conformant: 5 MUSTs |
| Adaptive Cards renderer (`adaptive-cards`) | [`renderers/adaptive-cards/`](../renderers/adaptive-cards/README.md) of this repository (prototype), Adaptive Cards 1.5 | portable | 65 | 0 | 0 | 16 | every check it can be driven through holds |
| Web Components (`webcomponent`) | abap2UI5/frontend-webcomponent 0.1.0, `dist/` built from `6997c40` (in development) | portable | 63 | 4 | 1 | 13 | work in progress: router not implemented, error markup stripped |
| headless ABAP simulator (`headless`) | - | - | - | - | - | - | not drivable: in-process, no HTTP seam ([frontend/README.md](frontend/README.md#adapters)) |

The UI5 SPA run is stable (two consecutive runs, identical results) and
takes about two minutes; `test/frontend.test.mjs` pins the UI5, the agent
and the Adaptive Cards result check by check. The UI5 pin accepts
`portable.box-details` passing: the fix of the UI5 frontend is under way
(open question 7, decided: expanded), and a local run against an abap2UI5
checkout that carries it (2026-10-03, abap2UI5 `ed8115b` on top of `833b5b8` "Show message box
details on UI5 1.120 and later", on its working branch, not on main yet)
passed it - every MUST held, 77 pass, 4 skip.

### Findings - the UI5 SPA

1. **Message box details are not shown on OpenUI5 >= 1.120** -
   `portable.box-details`, MUST; *the frontend is wrong.* A
   `MESSAGE_BOX` with `details` shows the text and an empty details area.
   Evidence (OpenUI5 1.144.0): the box's VBox holds `Text` (visible),
   `Link "View Details"` (hidden), `MessageStrip "Details could not be
   loaded."` (hidden), `FormattedText` (visible, `htmlText` empty).
   abap2UI5 `app/webapp/core/actions/ControlCall.js` `expandBoxDetails`
   makes the `FormattedText` visible and hides the link - but
   `sap.m.MessageBox` sets the details text only in the link's press handler
   (`showDetails`, 1.144.0 `MessageBox.js` line 249; the same in 1.120.0),
   while 1.71.80 set it when creating the control
   (`new FormattedText().setVisible(false).setHtmlText(mOptions.details)`).
   So the expansion works on 1.71 and leaves the details unreachable on
   every release since the lazy fill - including the 1.144.0 the abap2UI5
   e2e suite pins. Fix belongs in `expandBoxDetails` (set the sanitized
   details as `htmlText` itself, or press the link). Spec: details are shown
   with the box ([../spec/actions.md](../spec/actions.md#messages);
   alternative in [open question 7](../spec/open-questions.md#7-message-box-details-shown-or-behind-a-link)).
2. **An unknown control fails the view** - `portable.unknown-control`;
   *the spec was wrong.* `<x:Gadget xmlns:x="com.example.conformance"/>`
   ends in `ModuleError: failed to load 'com/example/conformance/Gadget.js'`
   and the fatal overlay. The portable profile called the UI5 frontend "a
   portable frontend by construction", which would require a placeholder;
   but in the UI5 profile every UI5 element is in the vocabulary and one that
   does not load is a failed view (and the frontend's SDK hint depends on
   that). The profile now says the UI5 frontend renders every portable app
   and binds the tolerance rule to the other renderers; the check skips a
   UI5-profile frontend ([open question 6](../spec/open-questions.md#6-the-ui5-frontend-and-the-portable-tolerance-rule)).

Everything else holds in the browser, with real controls: the envelope,
ID continuation (also an id seen before), raw JSON event arguments (`true`
stays `true`), the delta rules (whole scalars and structures, `__delta`
rows, nested `__delta`, the whole value beating a delta, the popup's own
model, no delta for pushed values, edits typed during a roundtrip kept), the
CONFIG cadence, `sap-contextid` kept, the CSRF handshake, no retry of a
500, one roundtrip at a time, the queue-last wire, PROTOCOL 3 refused
naming both numbers, unknown keys ignored, every slot rule including the
teardown on an APP change, model pushes only into the answering app's
slots, follow-up actions in order after rendering, an unknown action
skipped and logged, the box close event with the pressed action, the hash
under KEEP, Back restoring the caller's route, the app-state hash, and an
error body shown verbatim as text.

### Findings - the agent client

All five MUST failures are *the client's*; filed for abap2UI5/mcp-server.

1. **No PROTOCOL check** (`response.protocol-mismatch`): a `PROTOCOL: 3`
   response is adopted and described. `lib/appclient.mjs` `post` checks
   status, JSON and `S_FRONT` only.
2. **No stateful session id** (`transport.contextid-kept`): the
   `sap-contextid` response header is never read or sent back; a stateful
   ABAP app would meet a fresh work process on every act
   ([open question 9](../spec/open-questions.md#9-stateful-sessions-and-frontends-without-a-browser)).
3. **Overlapping acts** (`transport.one-at-a-time`): a second `act` while
   the first is in flight posts at once, continuing the same draft id
   ([open question 8](../spec/open-questions.md#8-one-roundtrip-at-a-time-for-frontends-driven-by-a-program)).
4. **Popups survive an app change** (`slots.app-change`):
   `lib/snapshot.mjs` `applyResponse` tears POPUP/POPOVER down only on a
   MAIN display or a destroy; a popup app answering with another `APP` leaves
   the previous app's popover in the snapshot.
5. **Error markup interpreted** (`error.as-text`): `errorText` extracts a
   `<pre>`, strips tags and decodes entities - written for the old HTML
   error page; the body is `text/plain` now. `<b>bold</b>` arrives as
   `bold`.

Warnings: no CSRF token handshake (`transport.csrf-token`); edits made with
an `act` while another is in flight are dropped, because `act` clears all
pending edits of the model after its response, not only the ones it sent
(`model.pending-survive-push`); the PROTOCOL message (follows from 1).
Skipped: the URL, DOM and focus checks (no browser), a nested-table cell
(the snapshot does not describe nested tables), a programmatic model edit.

### Findings - the Adaptive Cards renderer

A renderer that is not a browser, run in process
([../renderers/adaptive-cards/](../renderers/adaptive-cards/README.md)):
the card host speaks the protocol to the scripted backend, each answer is
rendered into an Adaptive Card 1.5 and the suite reads the card; a "press"
submits what a card host submits - the action's data merged with every input
value, ids being binding paths - and the renderer turns that back into the
request. All 65 checks that apply pass, two runs identical: the envelope,
ID continuation, raw event arguments (model arguments re-read after the
edits of the same submit), every delta rule including nested `__delta`
rows (the edits are found by comparing the submitted values with the model
the card was rendered from), `sap-contextid`, the CSRF handshake, no retry
of a 500, one roundtrip at a time (a submit in flight queues the next, open
question 8), PROTOCOL 3 refused, the slot rules (popup modal, popover not:
a press in MAIN closes it, as UI5 does), the NEST placeholder, toasts,
boxes and their close event, START_TIMER, an unknown and an excluded
follow-up action skipped and logged, the tolerance rule (an unknown control
becomes a placeholder and an `unsupported` entry), and an error body shown
verbatim (a `TextRun`, not markdown). Skipped: a URL (routing, Back, the
app-state hash), a DOM (the sanitizer probe, the box-details text probe -
the card shows the details expanded, as text), focus, a document title and
programmatic model edits; the UI5 and semantic profiles are not claimed.
Every golden card also validates with the Adaptive Cards JavaScript SDK
3.0.6 (`AdaptiveCard.parse` + `validateProperties`, no issue; run by hand,
not a dependency).

Found on the way, *the spec held*: nothing in the portable profile needed
a browser to be rendered; what a card cannot do (raise `change` events,
show a URL) the profile already lets a renderer drop or the edit travels
with the next action.

### Findings - the Web Components frontend (in development)

Run against the build of its development branch at the time; recorded for
its authors, not as a verdict. It passes every portable-profile check that
applies, including the tolerance rule, the NEST placeholder rule and the
box details. Failing: the `ROUTER` action and the URL hash are not
implemented yet (`router.keep`, `router.back-restores`, `router.app-state`;
`router.hash-sent` warns), and error markup is stripped (`error.as-text`) -
it vendors the agent client's `errorText`. Table cells were not addressed
(its DOM exposes control ids, not binding paths) and the box close is not
wired in the adapter yet.
