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
   [ACT] `factory_by_frontend`). The drafts linked that way are a
   **chain**: the draft just saved, the one its request continued, the
   one before that, and so on. One exception saves nothing: a
   [timer tick](request.md#the-timer-tick) that changed nothing MAY be
   answered with the id it continued ([below](#draft-ids)).

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
- **The one exception: an unchanged timer tick.** A response to a request
  with `S_FRONT.TIMER: true` ([request.md](request.md#the-timer-tick))
  whose app state the roundtrip left unchanged MAY name the id the request
  continued; the backend then writes no draft. A tick that changed the
  app state, and every request without `TIMER`, answers a new id as
  above. The reference compares the app container, serialized, with the
  draft it loaded byte for byte ([H] `main_end_reuse`, [CONT]
  `db_check_unchanged`; from abap2UI5 `cdd2fb25`, branch `DEV`) and
  renews the reused draft's time at most every five minutes so that a
  poll that finds nothing new keeps its draft past the expiry ([H]
  `main_end_save`, [DR] `touch`). Decided in revision 0.7
  ([open question 2](open-questions.md#2-a-new-draft-id-in-every-response)).
  *Checked by:* `session.timer-tick`.
- A frontend MUST continue whatever id the response named, the same one
  included; it MUST NOT read an unchanged id as an error or as "nothing
  happened" to anything but the app state - the response's sections and
  `MODEL` are applied as ever ([V1] `eB` sets `ID` from the response it
  adopted last).
- **Implementation note.** The reference does not reuse the id for a
  sticky app (it writes no draft per roundtrip), after a navigation hop,
  for a host with its own serializer (the Node runtime's, [NR]: its
  compare never succeeds, so every tick answers a new id there), and for
  a tick whose `main( )` handed out an app-state link
  (`app_state_get_href( )`: the link's draft is written) - [H]
  `main_end_reuse`.
- **Implementation note.** A draft id is not always new to the session: a
  return to a stacked app (`nav_app_leave`) answers with the id that app was
  saved under when it was called, so two leaves to the same caller answer
  the same id ([ACT] `prepare_app_stack` sets `ms_draft-id = val->id_draft`).
  A frontend MUST NOT assume a draft id is unique within a session.

## Drafts are snapshots

A draft is a snapshot of the state after one roundtrip; continuing it does
not consume it.

- A backend MUST continue a draft it still holds from **that** snapshot -
  also when later drafts of the same app exist. *Checked by:*
  `session.id-reuse`.
- It MUST hold, until they expire, the **newest draft of a chain and the
  one before it** - the draft a response named and the draft its request
  continued - for every chain ([below](#retention)). A frontend that
  continues one of these two - its last adopted id, or on a retry the id
  the lost response's request continued - always finds it.
  *Checked by:* `session.id-reuse`.
- The rows an app loaded into a
  [windowed table](windowed-tables.md#the-app-owns-the-order), and what it
  keeps to load more, are part of the snapshot like every attribute.
  *Checked by:* `window.order-with-the-draft`.
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

## Retention

Which drafts a backend holds beyond those two is its business, within
these limits:

- A backend MAY delete a draft before it expires once it is neither the
  newest nor the one before the newest of its chain - **unless it is
  protected**. Protected, and held until they expire:
  - the drafts of the app stack: the caller a `nav_app_leave` returns to
    and the draft a navigation hop came from ([navigation.md](navigation.md#the-app-stack)),
    and any draft another draft names as such;
  - the draft an app-state link names
    ([navigation.md](navigation.md#the-app-state-hash)), and the draft a
    route or an app-state restore started from
    ([navigation.md](navigation.md#routes));
  - every draft of an app whose app-state hash is active (its URL names
    each draft, and any of them can be bookmarked).
- *Checked by:* `session.retention-protected` (a route restore, the app
  stack).
- A deleted draft is an unknown one: an event on it is refused
  ([below](#unknown-and-expired-drafts)), a route to it starts its class
  fresh.
- A frontend MUST NOT rely on any other draft: it continues the id it
  adopted last, retries with the id the failed request continued, and
  reaches older states only through a route, an app-state link or the
  app stack - which name protected drafts.
- **Implementation note.** The reference prunes each chain to its last
  `draft_keep_per_chain` drafts - 2 by default from abap2UI5 `04ead8ec`
  (branch `DEV`), never fewer than 2, at most 50, 0 switches pruning off
  ([EXIT], `ty_s_http_config_post`). Every save deletes the draft at depth
  N + 1 of the chain it just extended, unless it is protected ([CONT]
  `db_save`, `mt_draft_keep`; [DR] `prune_chain`, `c_min_keep_per_chain`;
  from `cdd2fb25`). The minimum is 2 because of the retry: after the
  backend saved the response that got lost, the draft the frontend
  continues once more is depth 2. A Node runtime packed from that branch
  prunes the same way (the in-memory store is the framework's); the
  releases up to 1.150.0, and cap2UI5 0.7.0 on them, do not prune. Before
  revision 0.7 the specification required every draft to be held until
  it expired.

## Unknown and expired drafts

- An **event request** on a draft id the backend does not have - never
  issued, expired, pruned ([above](#retention)), another user's - MUST
  be refused with an error status ([errors.md](errors.md)); the reference answers 500 with
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
