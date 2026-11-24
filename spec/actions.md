# Follow-up actions

## Follow-up actions

A follow-up action is an entry of `S_FRONT.ACTIONS`
([response.md](response.md#actions)): a JSON array
`["<ACTION>", <arg>...]`. The arguments are strings, except that an
argument the app wrote as a JSON object or array travels as that JSON value
([EV] `get_event_client_ajson`); an action that takes an option object has
it as its last element ([FE] `build_global_call`).

- A backend MUST queue them in the order the app called them, messages
  included. *Checked by:* `action.follow-up`, `action.order`.
- A frontend MUST run them in order, after the views are rendered
  ([response.md](response.md#processing-order)).
- A frontend MUST skip an action it does not know - logging it - and go on
  with the next one; an action MUST NOT fail the response ([FA] `execute`).
- Trailing empty arguments are dropped, an empty argument between filled
  ones keeps its place ([EV] `get_event_client_ajson`).
- A frontend SHOULD report the action it skipped - a log line, or (a
  semantic frontend) an `unsupported` entry of its snapshot ([FA]
  `execute` logs `unknown action`, [AC] `analyzeScreen`).
- *Frontend checks:* `action.order`, `action.after-render`,
  `action.unknown-skipped`, `action.unknown-reported`,
  `portable.excluded-action`.

An argument spelled as an expression binding on an absolute model path -
`${/PATH}` - reaches the frontend as that text: nothing on the backend
resolves it ([EV] `get_event_client_ajson`). The UI5 frontend (from
abap2UI5 1.147.0 on) replaces every such argument after the action name by
the value at that path in the model, as UI5 does when the same call is
wired into a view; a path with nothing bound stays the text it was and is
logged ([FA] `resolveBoundArgs`, [LIB] `bindingPathOf`). The model is the
one of the slot the answering app filled - a popup app's arguments are
read from POPUP, not from the caller's MAIN ([SL] `responseModel`, from
1.149.0 on; before, the model of the MAIN view). Whether every frontend has to do the same is
[open question 11](open-questions.md#11-bound-arguments-of-queued-follow-up-actions).

The vocabulary is the `cs_event` constants of the client API ([IC]) plus the
whitelisted global targets of `CONTROL_GLOBAL` ([CC] `GLOBAL_TARGETS`). It
is listed below with the profile that defines what each does; a portable
renderer implements the subset of
[../profiles/portable.md](../profiles/portable.md#6-frontend-actions).

## Messages

`message_toast_display( )` and `message_box_display( )` ([IC]) become
follow-up actions on the whitelisted globals, without the `CONTROL_GLOBAL`
prefix ([FE] `msg_toast`, `msg_box`):

| Action | Shape |
|---|---|
| toast | `["MESSAGE_TOAST", "show", <text>, <options>?]` - options `duration` (integer ms), `onClose` (a backend event raised when it closes) |
| message box | `["MESSAGE_BOX", <type>, <text>, <options>?]` - `<type>` one of `show`, `alert`, `confirm`, `information`, `warning`, `error`, `success`; options `title`, `styleClass`, `onClose`, `actions` (array of button names or texts), `emphasizedAction`, `initialFocus`, `details` |

- Only what the app set travels; an absent option leaves the control's own
  default ([FE] `msg_toast`, `msg_box`). The backend maps the type
  `information` to `show` with the title `Information`, and an unknown type
  to `show` ([MSG] `box_resolve`; in [FE] up to abap2UI5 1.148.0).
- **Implementation note.** A message box over data with nothing to show
  (an empty table, an unbound reference) queues no action - except the
  type `error`, which from abap2UI5 1.149.0 on shows a standard text
  instead of no box ([MSG] `box_resolve`, [IC] `message_box_display`).
- `onClose` of a message box raises that backend event when the box
  closes, with the pressed action as its **first argument**
  ([CC] `showBox`: `eB([event], action)`). *Checked by:*
  `message.box-close-event`.
- `details` is HTML from the backend; a frontend MUST sanitise it before
  rendering ([LIB] `sanitizeMessageDetails` rebuilds it from a tag
  whitelist). A frontend that renders message boxes MUST show the details
  with the box: what `message_box_display( )` renders out of a table or a
  structure is the message itself ([CC] `expandBoxDetails` shows them
  expanded instead of behind UI5's "View Details" link; a link that reveals
  them is not enough - decided in revision 0.3,
  [open question 7](open-questions.md#7-message-box-details-shown-or-behind-a-link)).
- *Checked by:* `message.toast`, `message.box`, `message.box-options`.
- *Frontend checks:* `message.toast`, `message.box`,
  `message.box-close-event`, `message.details-sanitized`,
  `portable.box-details`.

## Vocabulary

| Action | Arguments | Profile |
|---|---|---|
| `SET_FOCUS` | control id, selection start?, selection end? | portable |
| `START_TIMER` | backend event, delay in ms, no-busy flag?, repeat flag? ([below](#the-timer)) | portable - the event is an ordinary roundtrip when the delay ends; a semantic frontend offers it as an action. The repeat flag is UI5 profile ([open question 16](open-questions.md#16-the-repeating-timer-in-portable-renderers)). *Checked by:* `action.timer`, `action.timer-repeat`. *Frontend checks:* `portable.timer`, `semantic.timer-action` |
| `STOP_TIMER` | none ([below](#the-timer)) | UI5 profile ([open question 16](open-questions.md#16-the-repeating-timer-in-portable-renderers)) - ends the timer. *Checked by:* `action.timer-repeat` |
| `SCROLL_TO`, `SCROLL_INTO_VIEW` | control id, ... | portable |
| `SET_TITLE`, `SET_FAVICON` | text / URL | portable. *Frontend check:* `portable.set-title` |
| `CLIPBOARD_COPY`, `DOWNLOAD_B64_FILE`, `OPEN_NEW_TAB`, `URLHELPER`, `LOCATION_RELOAD`, `SYSTEM_LOGOUT`, `STORE_DATA`, `KEYBOARD_SHORTCUT`, `PLAY_AUDIO` | per [IC] `follow_up_action` | portable (MAY be a no-op where the platform lacks it) |
| `MESSAGE_TOAST`, `MESSAGE_BOX` | above | portable |
| `BUSY_INDICATOR`, `INVISIBLE_MESSAGE`, `THEMING` | method, args | portable (via `CONTROL_GLOBAL`) |
| `VIEW_SLOTS` | `destroy`, slot | core - only as a wired frontend action, from `popup_close` / `popover_close` ([below](#wired-frontend-actions)); a backend says a teardown in `VIEWS`, never as a follow-up action |
| `SET_SIZE_LIMIT` | size | portable, MAY be a no-op |
| `CONTROL_BY_ID` | id, view, method, args... | UI5 profile - calls a whitelisted UI5 control method |
| `CONTROL_GLOBAL` | target, method, args..., options? | UI5 profile for the targets beyond the ones above (`ICON_POOL`, `POPUP`, `FORMATTING`) |
| `BINDING_CALL`, `BIND_ELEMENT`, `SET_ODATA_MODEL`, `SMART_VARIANT_INIT`, `FILTER_BAR_VARIANT_INIT` | per [IC] | UI5 profile |
| `CROSS_APP_NAV_TO_EXT`, `CROSS_APP_NAV_TO_PREV_APP`, `SET_TITLE_LAUNCHPAD` | per [IC] | UI5 profile, inside a launchpad |
| `SET_APP_FULL_WIDTH` | `X` for the launchpad's full width; no argument for its letterbox again | UI5 profile, inside a launchpad; silently nothing outside ([LP] `evSetAppFullWidth`; from abap2UI5 1.149.0) |
| `CROSS_APP_NAV_GET_LINKS` | target (`{ "semanticObject", "action"? }`), intent parameters, backend event | UI5 profile, inside a launchpad: the event is raised once the launchpad answered, its first argument the **text** of a JSON array of `{ intent, text, subTitle, semanticObject, action, params }`; outside a launchpad nothing is raised ([LP] `evCrossAppNavGetLinks`; from 1.149.0) |

The navigation family (`SET_NAV_ROUTING`, `SET_PUSH_STATE`, `HASH_REPLACE`,
`HASH_ATTACH_CHANGED`, `SET_APP_STATE_ACTIVE`) does **not** travel as
follow-up actions: the backend folds it into the options of `NAV`
([CL] `follow_up_action`, [navigation.md](navigation.md#the-nav-section)).
`HASH_BACK` is a follow-up action.

## The timer

`START_TIMER` raises a backend event once its delay has passed - a
**tick**, an ordinary event request marked `S_FRONT.TIMER: true`
([request.md](request.md#the-timer-tick)). From abap2UI5 `4a418249`
(branch `DEV`) it can repeat itself, and `STOP_TIMER` ends it ([VO]
`evStartTimer`, `evStopTimer`, `resumeRepeatTimer`; [IC]
`cs_event-start_timer`, `cs_event-stop_timer`).

```json
["START_TIMER", "TICK", "5000", "", "X"]
["STOP_TIMER"]
```

| Element | Content |
|---|---|
| [1] | the backend event of the tick |
| [2] | the delay in milliseconds, as text ([VO] `evStartTimer`: not a number is 0) |
| [3] | optional, the **no-busy** flag: the tick shows no busy indicator ([../profiles/ui5.md](../profiles/ui5.md#the-options-of-a-wire), `noBusy`) |
| [4] | optional, the **repeat** flag: the timer arms itself again after every response (below) |

The flags are ABAP booleans: `"X"`, `"true"` or `true` are on, anything
else - `""`, an absent element - is off ([CC] `castArg` `bool`). A repeat
without the no-busy flag keeps the empty element [3] in its place; only
trailing empty arguments are dropped ([above](#follow-up-actions), [EV]
`args_trim_trailing`). `STOP_TIMER` has no argument. A backend writes
both from the app's `follow_up_action( )` ([IC]: `t_arg` = event, delay,
no-busy flag, repeat flag; `cs_event-stop_timer` without `t_arg`); wired
into a view, `STOP_TIMER` is `.eF('STOP_TIMER')`
([below](#wired-frontend-actions)). *Checked by:* `action.timer-repeat`,
`ui5.frontend-wire`.

A frontend implementing the repeat flag and `STOP_TIMER` - the UI5
profile in this revision
([open question 16](open-questions.md#16-the-repeating-timer-in-portable-renderers)):

- **One timer.** A frontend instance has at most one timer. A
  `START_TIMER` replaces it, a pending tick and a repeating timer alike;
  one without the repeat flag is a one-shot timer again ([VO]
  `evStartTimer`: one slot `START_TIMER`, `timerRepeat` set or cleared by
  every `START_TIMER`). *Frontend check:* `ui5.timer-replace`.
- **The repeat.** Once a response has been applied - its views rendered,
  its follow-up actions run, the events it let through sent
  ([response.md](response.md#processing-order)) - a frontend MUST arm the
  repeating timer again with the same event, delay and no-busy flag: after
  the response to a tick and after the response to a user event alike.
  It MUST NOT arm it while a roundtrip is in flight, and no tick of it
  goes out while one is: a user event cancels the pending tick, and the
  response to that event arms it again with the full delay; an event sent
  right after a response (one a tick held back, a queue-last firing)
  leaves the arming to its own response
  ([transport.md](transport.md#client-behaviour)). A response that armed
  a timer itself (a `START_TIMER` among its actions) is not armed twice
  ([VO] `resumeRepeatTimer`, called last by [V1]
  `_processAfterRendering`; `state.isBusy`, the slot already filled).
  Every tick is an ordinary tick: `S_FRONT.TIMER: true`, the id the
  response before it named ([request.md](request.md#the-timer-tick)).
  *Frontend checks:* `ui5.timer-repeat`, `ui5.timer-repeat-user-event`.
- **`STOP_TIMER`** - as a follow-up action or as a wire - cancels the
  pending tick and ends a repeating timer; with no timer it does nothing,
  and it is no error ([VO] `evStopTimer`). The wire runs without a
  roundtrip ([below](#wired-frontend-actions)). *Frontend checks:*
  `ui5.timer-repeat`, `ui5.timer-stop`.
- **A timer belongs to its app.** A response that names another `APP` - a
  navigation, a popup app included - MUST end a repeating timer; the next
  app arms its own, and an app that wants its poll back after a called app
  returned starts it again ([V1] `_processAfterRendering`: the app switch
  clears `timerRepeat`). *Frontend check:* `ui5.timer-repeat-app-change`.
- Under a popup or popover of the same app the timer SHOULD go on; when
  the view that armed it is gone (the popup closed, MAIN rebuilt), its
  ticks go through MAIN ([VO] `resumeRepeatTimer`: the MAIN view's
  controller, and with no live controller at all the timer ends).
  *Frontend check:* `ui5.timer-repeat-popup`.
- An error the frontend shows instead of a response SHOULD end a
  repeating timer - it would tick roundtrips under the error ([SRV]
  `responseError`). *Frontend check:* `ui5.timer-repeat-error`.
- **Implementation note.** The UI5 frontend also ends a repeating timer
  on a Back/Forward restore - the restored screen arms its own ([SRV]
  `restoreFromRoute`) -, on `Server.reset` ([SRV] `reset`) and with the
  component ([CTX] `destroy`). A one-shot timer is cancelled by every
  roundtrip that starts before it fired ([V1] `eB`, [LIB]
  `cancelPendingTimers`) - an app keeps a one-shot poll going by arming
  it in every response, as up to `4a418249` it had to.
- **Implementation note.** A poll needs no state in the app: a tick that
  changes nothing MAY be answered with the id it continued, and writes no
  draft ([sessions.md](sessions.md#draft-ids)).

The requests are those of revision 0.7: a tick of a repeating timer is a
tick like any other.

## The offline queue

abap2UI5 1.149.0 and 1.150.0 carried an experimental follow-up action
`OFFLINE_QUEUE`: it named events of the app that the UI5 frontend kept
when their roundtrip failed for want of a network and sent again, in
order, once the network was back. It was withdrawn after 1.150.0 (main
`694fb262`, #3032) and is no part of protocol 3: no backend of protocol 3
queues it, and an event that cannot reach the backend ends as every other
failed roundtrip does ([errors.md](errors.md#what-a-frontend-does-with-it)).
A frontend that is sent the action by an older backend skips it like any
action it does not know ([above](#follow-up-actions)).

**Implementation note.** The UI5 frontend does not refuse to send an event
while the browser reports itself offline (`navigator.onLine`): a host
reachable only through a VPN or an intranet reports offline while the
backend answers ([V1] `eB`).

## Wired frontend actions

`_event_client( )`, or `follow_up_action( )` used as a view attribute, does
not queue anything: it writes a wire that runs the action in the browser on
the event, without a roundtrip ([CL] `follow_up_action`, `IF result IS
SUPPLIED`; [EV] `get_event_client`). The wire form is the UI5 profile's
`.eF('<ACTION>', <args>...)`
([../profiles/ui5.md](../profiles/ui5.md#event-wires)); the actions are the
same as above - `STOP_TIMER` among them, `.eF('STOP_TIMER')`
([above](#the-timer)). `cs_event-popup_close` and `popover_close` are written as
`.eF('CONTROL_GLOBAL', 'VIEW_SLOTS', 'destroy', 'POPUP'|'POPOVER')` - one
teardown path for the frontend ([EV] `map_client_event`). A frontend MUST
run such a wire without a roundtrip; the draft id stays the one it adopted
last. *Frontend check:* `slots.frontend-close`.
