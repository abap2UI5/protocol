# Errors

## The error response

When a roundtrip fails, the backend answers with an **error status and a
plain-text body** - never with a 2xx and never with a response object
([HTTP] `_main`, `_error_response`).

| Situation | Status | Reference |
|---|---|---|
| an exception in the app's `main( )`, in the framework, or while parsing the request (not JSON, more than 100 event arguments, an unknown or foreign draft id, an unknown app class, 1000 navigation hops) | **500** | [HTTP] `_main` - the single top-level catch |
| the CSRF gate refused the request | **403** | [transport.md](transport.md#csrf-and-origin) |
| a method other than GET, POST, HEAD | **405** | [transport.md](transport.md#other-methods) |
| the server in front did not reach the backend | 502, 503, 504 | (gateway, web dispatcher) |

- A backend MUST answer a failed roundtrip with a 4xx or 5xx status; a
  failure inside the backend MUST be a 5xx. *Checked by:*
  `error.app-exception`, `error.unknown-app`, `session.unknown-draft`,
  `transport.invalid-json`.
- The body MUST NOT be a response object (`{"S_FRONT": ...}`) and MUST NOT
  be empty. It SHOULD be `text/plain` with `X-Content-Type-Options:
  nosniff`, and the response SHOULD be `no-store` like every roundtrip
  response ([HTTP] `set_response`). *Checked by:* `error.app-exception`,
  `error.not-sniffable`.
- The body is for a **human**: its content is not normative. A backend
  SHOULD name the failure the app raised (the developer's only diagnostic);
  it MAY hide every detail on purpose. *Checked by:* `error.details`.
- A backend MUST NOT reflect request data it did not validate into the
  body. What it repeats from the request for diagnosis - the URL, the class
  name of an app start, an event name - is first reduced to characters that
  cannot be read as markup or close a quoted value (the reference strips the
  class name to `A-Z a-z 0-9 _ /`, [ACT] `app_start_safe`; the same strip
  applies to the URL, [H] `request_context_info`). The `text/plain` and
  `nosniff` rules above are the second line of defence, not the first: a
  body that is logged, mailed or pasted into a ticket leaves its headers
  behind. *Checked by:* `error.no-reflection`. (Decided in revision 0.3,
  [open question 3](open-questions.md#3-the-request-url-reflected-into-the-error-body).)

The reference body - unless the user exit hides details
([EXIT] `check_hide_error_details`, then it is `Internal Server Error`):

```
abap2UI5 1.146.0 - unhandled exception in a POST request

--- error ---
Request failed in app Z2UI5_CL_CONF_ERROR, event FAIL, draft 7298..., url /?app_start=Z2UI5_CL_CONF_ERROR
CONFORMANCE_FAILURE

--- exception chain ---
[1] Z2UI5_CX_UI5_UTIL_ERROR
    text     : Request failed in app ...
...
```

The first frame names the app, the event, the draft and the URL
([H] `request_context_info`); the chain follows with class, source position
and attributes of every cause ([HTTP] `_error_body`).

**Implementation notes.**

- abap2UI5 1.146.0 - the release both reference hosts run - still reflects
  the request URL into the first frame verbatim (the class name in it is
  stripped, the URL is not, [H] `request_context_info`) and fails
  `error.no-reflection`; the fix strips the URL like the class name
  ([../conformance/RESULTS.md](../conformance/RESULTS.md)). The frontend
  rule below (the body is shown as text, never as markup) keeps that body
  harmless on screen.
- cap2UI5 answers an exception that a **JavaScript** app throws with
  `roundtrip failed (<correlation id>)` and logs the cause on the server
  ([CAP] `cds-plugin.js` `roundtrip`): such an exception is not an ABAP
  exception, passes the framework's catch and reaches the plugin's. Errors
  the framework raises (an unknown draft, an unknown app) keep the
  framework's body there too.

## What a frontend does with it

The UI5 frontend ([SRV] `readHttp`, `responseError`; [EVW]):

- A non-2xx answer is an error: the frontend MUST show the body to the user
  **as text** - never as markup ([EVW] renders it through `textContent`) -
  and the status when the body is empty (`HTTP <status>`). As text means
  verbatim: a frontend MUST NOT strip, decode or otherwise interpret markup
  in it - the body is `text/plain`, and what looks like a tag in it (an
  exception text, or a URL a backend reflected against the rule above) is
  text. It MAY shorten a long body.
- A 2xx answer that is not JSON, or has no `S_FRONT`, or declares another
  `PROTOCOL` ([versioning.md](versioning.md)), is an error too.
- *Frontend checks:* `error.shown`, `error.as-text`, `error.empty-body`,
  `error.app-start`, `response.not-json`, `response.no-s-front`.
- After a network failure, a timeout or a 502/503/504 the frontend MAY offer
  a retry that re-sends the same body; after a 500 it MUST NOT re-send
  automatically ([transport.md](transport.md#client-behaviour)).
- The UI5 frontend ends the app with an overlay (Restart / Retry); another
  frontend MAY instead stay on the last adopted response and let the user
  continue from its draft id, which stays valid
  ([sessions.md](sessions.md#failed-roundtrips)).
- An error inside a follow-up action is the frontend's own business: it is
  logged and the next action runs ([actions.md](actions.md)); an error while
  building a view ends the roundtrip like a failed response ([FA]
  `executeSystem`).
