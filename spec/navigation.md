# Navigation

## Which app a request starts

A request with a draft id continues that draft ([sessions.md](sessions.md));
everything below is about requests **without** one. The backend decides in
this order ([H] `request_json_to_abap`, `main_begin`; [ACT]
`factory_first_start`, `factory_system_startup`):

1. **A route in `HASH`** - `#/app/<CLASS>` or `#/app/<CLASS>/<DRAFT>` in the
   app part of the hash ([routes](#routes)). A draft segment restores that
   draft; without one, or when the draft is gone, `<CLASS>` starts fresh.
2. **The launchpad's startup parameter** `app_start` (the first value of
   `CONFIG.ComponentData.startupParameters.app_start`).
3. **`?app_start=<CLASS>`** in `SEARCH`, together with an app-state draft
   from `#/z2ui5-xapp-state=<DRAFT>` in the hash when there is one
   ([the app-state hash](#the-app-state-hash)).
4. **Nothing named** - the backend's own start app (abap2UI5:
   `Z2UI5_CL_UI5_APP_START`, a page to type a class name into). A backend
   SHOULD answer such a request with a valid response that displays some
   MAIN view. *Checked by:* `nav.system-startup`, `transport.empty-body`.

Rules:

- A route MUST win over `?app_start=`: once a session runs with routing, the
  hash is the navigation state (Back/Forward, reload, bookmark) and the query
  only the boot value. *Checked by:* `route.precedence`,
  `route.start-by-class`.
- A backend MUST read the class name case-insensitively (trimmed, upper
  case). It SHOULD also accept a percent-encoded namespace (`%2Fns%2Fcl`)
  and the launchpad spelling `-ns-cl` for `/ns/cl` ([H]
  `app_start_normalize`). *Checked by:* `response.app-start-normalized`.
- A class that does not exist or is no app MUST be refused with an error
  status, not with a start app ([ACT] `app_create`, [errors.md](errors.md)).
  *Checked by:* `error.unknown-app`.
- The started app runs with `check_on_init( )` and `check_on_navigated( )`
  true ([sessions.md](sessions.md#lifecycle-flags-the-app-sees)).

## The app stack

`nav_app_call( app )` and `nav_app_leave( )` ([IC]) move the screen between
app instances inside one roundtrip; the frontend only sees the result: a
response whose `APP` is the app that now has the screen
([H] `main_process`, [ACT] `factory_stack_call`, `factory_stack_leave`,
`prepare_app_stack`).

- **Call.** The backend saves the calling app (as a draft of its own), runs
  the called instance's `main( )` with `check_on_init( )` and
  `check_on_navigated( )` true, and answers with the called app's `APP`, its
  view and its model. What the leaving app queued for the frontend goes with
  it - except a slot destroy, which carries over. *Checked by:* `nav.call`.
- **Leave.** The backend restores the app below on the stack from the draft
  saved at the call, runs its `main( )` with `check_on_navigated( )` true -
  and with the event the leaving app named (`nav_app_leave( event = ... )`),
  so a return with a result is told from a plain one; data handed over as
  `r_data` arrives as `get( )-r_event_data`, and `get_app_prev( )` is the
  instance that left. The MAIN display of that response SHOULD carry
  `navBack: true` (a way back plays the page change in reverse).
  *Checked by:* `nav.leave-with-result`, `nav.leave-is-back`.
- A leave with nothing on the stack ends the roundtrip without a hop ([H]
  `main_process`).
- Several hops can happen in one roundtrip (A calls B, B leaves at once);
  the reference stops after 1000 with an error ([H] `main_loop`).
- POPUP and POPOVER die with every app switch
  ([response.md](response.md#view-slots)).
- The hash-routing mode is inherited by a called app that has none of its
  own ([ACT] `prepare_app_stack`).

## The reserved leave event

`client->_event_nav_app_leave( )` writes a wire for the event
**`___ZZZ_NAL`** ([TY] `cs_event_nav_app_leave`, [CL]). A request with that
event does not run the app: the backend leaves it as if its `main( )` had
called `nav_app_leave( )` ([H] `main_process`). The UI5 profile writes it as
`.eB(['___ZZZ_NAL'])`, typically on a Page's `navButtonPress`.

- A backend MUST implement it; a frontend sends it like any other event.
  *Checked by:* `nav.leave-reserved-event`, `ui5.leave-wire`.

## Routes

An app opts into hash routing with `follow_up_action( cs_event-hash_routing
)` and a mode ([IC] `cs_nav_mode`); from then on the frontend keeps the URL
hash in step with the app on screen ([RT] header comment):

| Mode | Hash | Back/Forward, reload, bookmark |
|---|---|---|
| `KEEP` | `#/app/<CLASS>/<DRAFT>` | restore that exact draft |
| `FRESH` | `#/app/<CLASS>` | start the class fresh |
| `DEFAULT` | (routing off) | - |

- A namespaced class carries the separator in its name; the route writes it
  as `app//NS/CL_X/<DRAFT>` and both sides split it after the second slash
  of the class token ([H] `route_split`, [RT] `segmentsOf`).
- Leading slashes may stack (`#//app/X`, written by older HashChanger
  versions); both sides MUST strip them ([H] `parse_app_route_rest`).
- When the user navigates the browser history (or edits the URL), the
  frontend sends an **app-start-shaped request** - no `ID`, the new `HASH`
  - and the backend restores per [the order above](#which-app-a-request-starts)
  ([SRV] `restoreFromRoute`). A restored draft is answered with a new draft
  id and a MAIN display. *Checked by:* `route.restore-draft`.
- A route to a draft that is gone starts the class fresh and SHOULD queue a
  toast saying so. *Checked by:* `route.expired-draft`.

## Launchpad hashes

Inside the SAP Fiori launchpad the shell owns the front of the hash:
`#<SemanticObject>-<action>&/app/<CLASS>/<DRAFT>`. Only the part after
`&/` is the app's ([RT] `splitHash`, [H] `hash_get_app_part`):

- A hash that starts with `/` is all app (an app hash may contain `&/`
  itself, so this test comes first).
- Otherwise everything before the first `&/` is the shell's and everything
  after it the app's; without `&/` it is all app.
- Both halves MUST be split by this one rule on both sides; a frontend MUST
  NOT rebuild a URL from anything but the shell part plus an app hash.
  *Checked by:* `route.launchpad-shell-hash`.

## The app-state hash

`app_state_set_active( )` ([IC]) keeps the id of the **current** draft in
the hash: `#/z2ui5-xapp-state=<DRAFT>`. A reload, a bookmark or a shared
link opens it with `?app_start=<CLASS>` and the hash, and the backend
restores that draft ([H] `request_app_start_draft`).

- A restore through the app-state hash MUST keep the hash active: the
  response, and every later one of that app, carry
  `setAppStateActive: true` in the `ROUTER` action - a frontend clears the
  hash on a response that does not ([H] `main_end_nav`, [ACT]
  `factory_first_start`). *Checked by:* `route.app-state`.
- A route restore (`#/app/...`) is not an app-state opt-in and MUST NOT turn
  the app-state hash on.

## The router action

`["ROUTER", "sync", <options>]` carries what the URL has to reflect after
this response ([FE] `nav_serialize`, [RT] `sync`):

| Option | Meaning |
|---|---|
| `setNavRouting` | the routing mode: `KEEP`, `FRESH`, `DEFAULT` (off); absent = no change |
| `checkNavAppCall` | `true`: this response is a `nav_app_call` under routing - push a new history entry so Back returns to the caller |
| `navAppCallPrevApp`, `navAppCallPrevId` | the caller and the draft it was saved under at the call; the frontend repoints the caller's history entry at it first, so Back restores the caller with the edits the event carried |
| `setPushState` / `setHashReplace` | an app-owned hash value to write, with / without a history entry (`hash_set`, `hash_replace`) |
| `setHashEvent` | the backend event to raise when the hash changes under the app (app-owned routing, routing off); a single blank unregisters |
| `setAppStateActive` | `true`: write `#/z2ui5-xapp-state=<ID>` |

Rules for the backend:

- The action MUST be the **last** entry of `T_SYSTEM`, so the URL reflects
  the views that were built. *Checked by:* `route.mode`.
- It MUST be sent only when the roundtrip carries navigation intent, and
  then once, with one options object. The mode is (re)sent on an
  app-start-shaped request, on every navigation hop, and when the app's
  mode differs from what was last sent - not on a plain event of the same
  app ([H] `main_end_nav`). *Checked by:* `route.mode-not-repeated`.
- On a hop to an app without a mode of its own (none inherited), the mode
  MUST be sent as `DEFAULT`, so the previous app's routing does not stay on
  ([H] `main_end_nav`).
- A `nav_app_call` under `KEEP` or `FRESH` MUST set `checkNavAppCall` and
  name the first caller of the roundtrip in `navAppCallPrevApp` /
  `navAppCallPrevId` ([ACT] `factory_stack_call`). *Checked by:*
  `route.call-push`.

Rules for the frontend:

- A frontend that has a URL MUST synchronise it once per response - with
  the `ROUTER` options when present and the response's `ID` either way
  ([V1] `_processAfterRendering`); a frontend without a URL (native, agent)
  MAY ignore the action.
- An embedded frontend (a component inside a host app) MUST leave the hash
  to its host and send no `HASH` ([RT] `sync`, [SRV] `roundtrip`).
- With `setHashEvent` registered, a hash change raises that event as an
  ordinary event request; the new hash travels in `S_FRONT.HASH` ([RT]
  `dispatchAppHashChange`).
