# Navigation

## Which app a request starts

A request with a draft id continues that draft ([sessions.md](sessions.md));
everything below is about requests **without** one. The backend decides in
this order ([H] `request_json_to_abap`, `main_begin`; [ACT]
`factory_first_start`, `factory_system_startup`):

1. **A route** - `ROUTE.APP`, with `ROUTE.DRAFT` when the route names a
   draft: what the frontend parsed out of `#/app/<CLASS>` or
   `#/app/<CLASS>/<DRAFT>` ([request.md](request.md#route),
   [routes](#routes)). A draft restores that draft; without one, or when
   the draft is gone, the class starts fresh.
2. **The launchpad's startup parameter** `app_start` (the first value of
   `CONFIG.ComponentData.startupParameters.app_start`).
3. **`?app_start=<CLASS>`** in `SEARCH`, together with the app-state draft
   `ROUTE.APP_STATE` when the hash was an app-state link
   ([the app-state hash](#the-app-state-hash)) - or that app-state draft
   alone, when nothing above names a class ([H] `main_begin`).
4. **Nothing named** - the backend's own start app (abap2UI5:
   `Z2UI5_CL_UI5_APP_START`, a page to type a class name into). A backend
   SHOULD answer such a request with a valid response that displays some
   MAIN view. *Checked by:* `nav.system-startup`, `transport.empty-body`.

Rules:

- A route MUST win over `?app_start=`: once a session runs with routing, the
  hash is the navigation state (Back/Forward, reload, bookmark) and the query
  only the boot value ([H] `request_json_to_abap`). *Checked by:*
  `route.precedence`, `route.start-by-class`.
- The backend reads no hash: what `HASH` holds is no input of this
  decision, and a route in it that the frontend did not send as `ROUTE`
  starts nothing ([request.md](request.md#route)). *Checked by:*
  `route.hash-not-read`.
- A backend MUST read the class name case-insensitively (trimmed, upper
  case). It SHOULD also accept a percent-encoded namespace (`%2Fns%2Fcl`)
  and the launchpad spelling `-ns-cl` for `/ns/cl` in `SEARCH` ([H]
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
  it - except the teardown of a slot, which carries over. *Checked by:*
  `nav.call`.
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
- POPUP and POPOVER die with every app switch, and the backend says so:
  the response of a hop carries their teardown in `VIEWS` unless the app
  that takes the screen displays them
  ([response.md](response.md#view-slots)). *Checked by:*
  `slots.hop-teardown`.
- The hash-routing mode is inherited by a called app that has none of its
  own ([ACT] `prepare_app_stack`).

## The reserved leave event

`client->_event_nav_app_leave( )` writes a wire for the event
**`___ZZZ_NAL`** ([TY] `cs_event_nav_app_leave`, [CL]). A request with that
event does not run the app: the backend leaves it as if its `main( )` had
called `nav_app_leave( )` ([H] `main_process`). The UI5 profile writes it as
`.eB(['___ZZZ_NAL'])`, typically on a Page's `navButtonPress`.

- A backend MUST implement it; a frontend sends it like any other event.
  *Frontend check:* `request.leave-event`.
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

- The frontend writes the route and is the one side that reads it back:
  what a route names reaches the backend parsed, as `ROUTE`
  ([request.md](request.md#route), [RT] `parse`, `startRoute`).
- A namespaced class carries the separator in its name; the route writes it
  as `app//NS/CL_X/<DRAFT>`, and the frontend splits it after the second
  slash of the class token - `ROUTE.APP` is `/NS/CL_X` ([RT] `patternFor`,
  `parse`).
- Leading slashes may stack (`#//app/X`, written by older HashChanger
  versions, alive in bookmarks); a frontend MUST strip them before it
  reads a route ([RT] `segmentsOf`).
- When the user navigates the browser history (or edits the URL), the
  frontend sends an **app-start-shaped request** - no `ID`, the new `HASH`
  and the `ROUTE` parsed from it - and the backend restores per
  [the order above](#which-app-a-request-starts) ([SRV]
  `restoreFromRoute`). A restored draft is answered with a new draft id
  and a MAIN display. *Checked by:* `route.restore-draft`.
  *Frontend checks:* `router.back-restores`, `router.start-route`.
- A route to a draft that is gone starts the class fresh and SHOULD queue a
  toast saying so. *Checked by:* `route.expired-draft`.
- **Implementation note.** A backend that prunes its draft chains
  ([sessions.md](sessions.md#retention)) leaves every route of the UI5
  frontend's history a draft to restore: within an app the router
  replaces its history entry with the newest draft, the caller's entry
  points at the draft the hop came from (protected as part of the app
  stack), and a restore starts a new chain from the restored draft
  (protected) - abap2UI5 `docs/agents/architecture-seams.md` "Fewer
  drafts", [RT] `sync`. What is left is expiry.

## Launchpad hashes

Inside the SAP Fiori launchpad the shell owns the front of the hash:
`#<SemanticObject>-<action>&/app/<CLASS>/<DRAFT>`. Only the part after
`&/` is the app's ([RT] `splitHash`):

- A hash that starts with `/` is all app (an app hash may contain `&/`
  itself, so this test comes first).
- Otherwise everything before the first `&/` is the shell's and everything
  after it the app's; without `&/` it is all app.
- A frontend MUST read a route or an app-state link from the app part
  only - a launchpad intent is no route, and `ROUTE` of a request sent
  from `#<shell>&/app/<CLASS>` names `<CLASS>` ([RT] `splitHash`,
  `startRoute`). It MUST NOT rebuild a URL from anything but the shell
  part plus an app hash. *Frontend check:* `router.start-route`.
- The backend parses no route, but it composes links: the share link of
  `app_state_get_href( )` keeps the launchpad's part of `HASH` in front of
  the app-state hash, split by the same rule ([H] `hash_get_shell_part`,
  [CL] `app_state_get_href`).

## The app-state hash

`app_state_set_active( )` ([IC]) keeps the id of the **current** draft in
the hash: `#/z2ui5-xapp-state=<DRAFT>`. A reload, a bookmark or a shared
link opens it with `?app_start=<CLASS>` and the hash; the frontend sends
the draft as `ROUTE.APP_STATE` ([RT] `appStateOf`,
[request.md](request.md#route)), and the backend restores it ([H]
`request_json_to_abap`, [ACT] `factory_first_start`).

- A restore through the app-state hash MUST keep the hash active: the
  response, and every later one of that app, carry
  `setAppStateActive: true` in `NAV` - a frontend clears the hash on a
  response that does not ([H] `main_end_nav`, [ACT]
  `factory_first_start`). *Checked by:* `route.app-state`.
- A route restore (`ROUTE.APP`) is not an app-state opt-in and MUST NOT turn
  the app-state hash on ([H] `request_json_to_abap`).
- The app-state hash names the app as well: a session that reached its app
  by navigation has no `?app_start=` in its URL, and its bookmark is the
  hash alone. A backend SHOULD restore the draft of such a request like
  one that names the class ([H] `main_begin`: an app-state draft makes the
  request a first start). When that draft is gone no class is left to
  start fresh, so the request ends where one that names nothing ends - on
  the backend's start app - and SHOULD tell the user with a message ([ACT]
  `factory_first_start`). *Checked by:* `route.app-state-names-no-app`.
- **Implementation note.** Up to abap2UI5 1.146.0 a request with the
  app-state hash and no class opened the start app and dropped the saved
  state without a word. From 1.149.0 on a draft that exists and is the
  user's but cannot be restored ends in an error response
  ([errors.md](errors.md)) that names the cause, not in a fresh app with
  the "expired" message - that is left to a draft that is gone or another
  user's ([ACT] `factory_first_start`, `APP_STATE_RESTORE_ERROR`).

## The app-owned hash

An app that does not use the routes above can keep a hash of its own - a
tab, a selected object - and hear the browser's Back and Forward on it
([IC] `cs_event-hash_attach_changed`, `hash_set`, `hash_replace`; [RT]
`applyHashEvent`, `dispatchAppHashChange`, `sync`). Three options of
[`NAV`](#the-nav-section) carry it: `setHashEvent` registers the
listener, `setPushState` writes a value with a history entry,
`setHashReplace` without one.

- With `setHashEvent` registered, a hash change raises that event as an
  ordinary event request; the new hash travels in `S_FRONT.HASH` ([RT]
  `dispatchAppHashChange`). A single blank unregisters ([RT]
  `applyHashEvent`).
- **An app writes the hash only as its owner.** A frontend MUST write the
  value of `setPushState` / `setHashReplace` only while the app owns the
  hash - a listener registered with `setHashEvent` (the same response may
  register and write) and routing off - and then as the **whole** app
  hash. Under `KEEP` or `FRESH` the hash is the router's, and without a
  listener nobody would hear a Back onto what was written: such a write
  MUST NOT change the URL, and SHOULD be reported ([RT] `sync` logs it;
  [IC] `hash_set`, `hash_replace`). *Frontend check:*
  `router.hash-write-owner`.
- While a listener owns the hash the UI5 frontend leaves it alone between
  the app's own writes - it does not write the app-state hash over it:
  the two are exclusive, each claims the whole app hash ([RT] `sync`).
- The listener dies with the page of its app: a response that puts
  another app's view on MAIN ends it ([V1] `_processAfterRendering`,
  `_replacesMainOwner`); the backend keeps no record of it.
- **Implementation note.** A hash change that arrives while a roundtrip
  is in flight is parked and raised once the response has landed - only
  the last one ([RT] `dispatchPendingAppHash`). Until protocol 3 the UI5
  frontend appended a value an app wrote to the hash the page had -
  behind the route under `KEEP`, with `history.pushState` otherwise. That
  write bypassed the HashChanger's cache (the next Back went nowhere) and
  grew the URL with every roundtrip of an app that wrote a whole route;
  both suffix writes are gone ([RT] `sync`).

## The NAV section

`S_FRONT.NAV` carries what the URL has to reflect after this response, as
one options object ([FE] `nav_serialize`, [RT] `sync`):

| Option | Meaning |
|---|---|
| `setNavRouting` | the routing mode: `KEEP`, `FRESH`, `DEFAULT` (off); absent = no change |
| `checkNavAppCall` | `true`: this response is a `nav_app_call` under routing - push a new history entry so Back returns to the caller |
| `navAppCallPrevApp`, `navAppCallPrevId` | the caller and the draft it was saved under at the call; the frontend repoints the caller's history entry at it first, so Back restores the caller with the edits the event carried |
| `setPushState` / `setHashReplace` | an app-owned hash value to write, with / without a history entry (`hash_set`, `hash_replace`) |
| `setHashEvent` | the backend event to raise when the hash changes under the app (app-owned routing, routing off); a single blank unregisters |
| `setAppStateActive` | `true`: write `#/z2ui5-xapp-state=<ID>` |

Rules for the backend:

- An option the roundtrip did not set MUST be absent, and the whole
  section when none is set - a response without navigation intent has no
  `NAV` ([FE] `nav_serialize`, [H] `response_abap_to_json`). An app that
  switches routing on gets its mode into the section as `setNavRouting`.
  *Checked by:* `route.mode`.
- The mode is (re)sent on an app-start-shaped request, on every navigation
  hop, and when the app's mode differs from what was last sent - not on a
  plain event of the same app ([H] `main_end_nav`). *Checked by:*
  `route.mode-not-repeated`.
- On a hop to an app without a mode of its own (none inherited), the mode
  MUST be sent as `DEFAULT`, so the previous app's routing does not stay on
  ([H] `main_end_nav`).
- A `nav_app_call` under `KEEP` or `FRESH` MUST set `checkNavAppCall` and
  name the first caller of the roundtrip in `navAppCallPrevApp` /
  `navAppCallPrevId` ([ACT] `factory_stack_call`). *Checked by:*
  `route.call-push`.

Rules for the frontend:

- A frontend that has a URL MUST synchronise it once per response - with
  the options of `NAV` when the response has the section and the
  response's `ID` either way ([V1] `_processAfterRendering`, [RT] `sync`);
  a frontend without a URL (native, agent) MAY ignore the section.
- An embedded frontend (a component inside a host app) MUST leave the hash
  to its host and send neither `HASH` nor `ROUTE` ([RT] `sync`, `init`;
  [SRV] `roundtrip`) - unless the host handed the page's URL back to it
  (the UI5 component's `ownsPage` setting, `state.ownsPage`): then the
  hash is the frontend's own again, and the rules above apply to it.
- What an app may write into the hash, and when, is
  [the app-owned hash](#the-app-owned-hash).
- *Frontend checks:* `router.keep`, `router.back-restores`,
  `router.app-state`, `router.hash-sent`.
