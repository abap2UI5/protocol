# Results

Backend suite, profile `ui5` (75 checks: 68 core, 7 UI5-profile; 61 MUST,
14 SHOULD), run 2026-10-03 with `npm run conformance:<backend>`. The traffic
of these runs is recorded in [`../traffic/`](../traffic/).

| Backend | Version | Apps | Pass | Fail | Warn | Skip | Verdict |
|---|---|---|---:|---:|---:|---:|---|
| `node-runtime` | `@abap2ui5/node-runtime` 1.146.0 (abap2UI5 1.146.0, transpiled) | the ABAP apps, transpiled with `@abaplint/transpiler-cli` 2.13.93 | 75 | 0 | 0 | 0 | conformant, `core` and `ui5` |
| `cap2ui5` | `@cap2ui5/cds-plugin` 0.4.0 on `@abap2ui5/node-runtime` 1.146.0, `@sap/cds` 10 | the JavaScript apps | 74 | 0 | 1 | 0 | conformant, `core` and `ui5` |

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
| error | 4 | 4 pass | 3 pass, 1 warn (`error.details`) |
| ui5 | 7 | 7 pass | 7 pass |

The ABAP system itself (abap2UI5 on NetWeaver / ABAP Cloud) has not been run
yet - it needs a system with the apps pulled in by abapGit; the transpiled
runtime is the same framework source.

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
- **The request URL is reflected unescaped into the 500 body** - safe only
  as `text/plain` + `nosniff` + a frontend that renders text; recorded as an
  implementation note, the headers as SHOULD
  ([../spec/errors.md](../spec/errors.md#the-error-response)).
- **`DEFAULT` routing mode on every hop to an app without a mode** -
  normative ([../spec/navigation.md](../spec/navigation.md#the-router-action)).
- **Event argument conversion** (`true` -> `X`, `null`/`false` -> empty,
  objects -> compact JSON text) - normative, the same on both backends.
