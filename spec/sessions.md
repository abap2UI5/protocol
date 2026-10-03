# Sessions and drafts

## Drafts

The protocol is stateless on the wire: between two roundtrips the backend
keeps the app instance - every attribute, bound or not - as a **draft**,
and the response names it ([DR], [H] `main_end_save`).

1. The request names the draft it continues (`S_FRONT.ID`).
2. The backend restores the app from that draft, applies the model delta,
   runs `main( )` (and any navigation hops).
3. It saves the result as a **new** draft and answers its id as
   `S_FRONT.ID`; the new draft records the one it came from (`id_prev`,
   [ACT] `factory_by_frontend`).

The draft table, its serialization and its location are the backend's
business: a database table on an ABAP system (`Z2UI5_T_01`), in-memory
SQLite on the Node runtime ([NR] README "Persistence"), a CDS entity on
cap2UI5 (`cap2ui5.Drafts`, [CAP]).

## Draft ids

- A draft id is an **opaque** string. A frontend MUST NOT parse it or build
  one; it only sends back what a response gave it. (The reference mints 32
  upper-case hex characters, [ACT] `uuid_get_c32`.)
- Every 2xx response MUST name a draft id different from the one its
  request continued; the request's state carries over through it.
  *Checked by:* `session.new-id`, `session.continuation`.
- **Implementation note.** A draft id is not always new to the session: a
  return to a stacked app (`nav_app_leave`) answers with the id that app was
  saved under when it was called, so two leaves to the same caller answer
  the same id ([ACT] `prepare_app_stack` sets `ms_draft-id = val->id_draft`).
  A frontend MUST NOT assume a draft id is unique within a session.

## Drafts are snapshots

A draft is a snapshot of the state after one roundtrip; continuing it does
not consume it.

- A backend MUST accept any draft id it issued to the same user until the
  draft expires, and continue from **that** snapshot - also when later
  drafts of the same app exist. *Checked by:* `session.id-reuse`.
- This is what makes a frontend's **retry** safe (a network failure after
  the backend processed the request: the re-sent body continues the old id
  once more, [SRV] `readHttp` `onRetry`) and what browser history uses to
  restore an earlier state through a route
  ([navigation.md](navigation.md#routes)).

## Ownership and expiry

- A backend SHOULD hand a draft only to the user that created it, and treat
  another user's draft id exactly like an unknown one - a leaked or guessed
  id (bookmarks carry them) must not restore someone else's state ([DR]
  `read`: the `UNAME` column; cap2UI5 scopes drafts by the CAP user).
- Drafts expire. The reference deletes drafts older than
  `draft_exp_time_in_hours` (default 4) on every app start ([DR] `cleanup`,
  [H] `main_begin`, [EXIT]); the Node runtime keeps them only for the life
  of the process.

## Unknown and expired drafts

- An **event request** on a draft id the backend does not have - never
  issued, expired, another user's - MUST be refused with an error status
  ([errors.md](errors.md)); the reference answers 500 with
  `NO_DRAFT_ENTRY_OF_PREVIOUS_REQUEST_FOUND` in the body ([DR] `read`). A
  backend MUST NOT silently start a fresh app under an event: the event was
  meant for state that is gone. *Checked by:* `session.unknown-draft`.
- An **app start** that names a draft through a route or the app-state hash
  that is gone starts the class fresh instead, and SHOULD tell the user with
  a toast ([ACT] `factory_first_start`, the `CATCH`)
  ([navigation.md](navigation.md#routes)). *Checked by:* `route.expired-draft`.

## Failed roundtrips

- A roundtrip that fails (any error response) MUST NOT save a draft: the
  draft the request continued stays the latest usable state, and whatever
  the app changed before it failed is discarded. The reference saves only at
  the very end of a successful roundtrip and rolls back the database
  transaction of a non-stateful app around `main( )` ([H] `main_process`,
  `main_end_save`). *Checked by:* `session.failed-roundtrip-not-persisted`.
- A frontend that shows the error MAY offer to continue (retry, or another
  event) with the draft id it last adopted.

## The session block

What the browser told the backend about itself - the `CONFIG` blocks and
the location fields ([request.md](request.md#config-the-session-block)) -
is stored with the draft (`ms_session`, [H] `session_merge`) and copied to
every app the session navigates to ([ACT] `prepare_app_stack`). That is why
a frontend sends it once per page load and on app-start-shaped requests
only, and why an event request without it is answered with the stored
values.

## Lifecycle flags the app sees

The backend tells the app why it runs ([IC]); a frontend cannot observe the
flags directly, but every rendering decision of an app depends on them:

| Flag | True on |
|---|---|
| `check_on_init( )` | the first roundtrip of this app **instance** |
| `check_on_navigated( )` | every roundtrip that gives the app the screen: a fresh start, a draft restored through a route or the app-state hash, a `nav_app_call` into it, a `nav_app_leave` back to it ([ACT] factories) |
| `check_on_event( )` | a roundtrip with an event |

A backend MUST set `check_on_navigated( )` on all of those roundtrips -
apps display their view there, and a backend that forgot one leaves the
previous screen standing with no error anywhere.
