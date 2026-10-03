# Follow-up actions

## Follow-up actions

A follow-up action is an entry of `S_FRONT.S_ACTION.T_CUSTOM`: a JSON array
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
  to `show` ([FE] `box_resolve`).
- `onClose` of a message box raises that backend event when the box
  closes, with the pressed action as its **first argument**
  ([CC] `showBox`: `eB([event], action)`). *Checked by:*
  `message.box-close-event`.
- `details` is HTML from the backend; a frontend MUST sanitise it before
  rendering ([LIB] `sanitizeMessageDetails` rebuilds it from a tag
  whitelist).
- *Checked by:* `message.toast`, `message.box`, `message.box-options`.

## Vocabulary

| Action | Arguments | Profile |
|---|---|---|
| `SET_FOCUS` | control id, selection start?, selection end? | portable |
| `START_TIMER` | backend event, delay in ms, no-busy flag? | portable - the event is an ordinary roundtrip when the delay ends. *Checked by:* `action.timer` |
| `SCROLL_TO`, `SCROLL_INTO_VIEW` | control id, ... | portable |
| `SET_TITLE`, `SET_FAVICON` | text / URL | portable |
| `CLIPBOARD_COPY`, `DOWNLOAD_B64_FILE`, `OPEN_NEW_TAB`, `URLHELPER`, `LOCATION_RELOAD`, `SYSTEM_LOGOUT`, `STORE_DATA`, `KEYBOARD_SHORTCUT`, `PLAY_AUDIO` | per [IC] `follow_up_action` | portable (MAY be a no-op where the platform lacks it) |
| `MESSAGE_TOAST`, `MESSAGE_BOX` | above | portable |
| `BUSY_INDICATOR`, `INVISIBLE_MESSAGE`, `THEMING` | method, args | portable (via `CONTROL_GLOBAL`) |
| `VIEW_SLOTS` | `destroy`, slot | core (system action; as follow-up only from a wired `popup_close`) |
| `SET_SIZE_LIMIT` | size | portable, MAY be a no-op |
| `CONTROL_BY_ID` | id, view, method, args... | UI5 profile - calls a whitelisted UI5 control method |
| `CONTROL_GLOBAL` | target, method, args..., options? | UI5 profile for the targets beyond the ones above (`ICON_POOL`, `POPUP`, `FORMATTING`) |
| `BINDING_CALL`, `BIND_ELEMENT`, `SET_ODATA_MODEL`, `SMART_VARIANT_INIT`, `FILTER_BAR_VARIANT_INIT` | per [IC] | UI5 profile |
| `CROSS_APP_NAV_TO_EXT`, `CROSS_APP_NAV_TO_PREV_APP`, `SET_TITLE_LAUNCHPAD` | per [IC] | UI5 profile, inside a launchpad |

The navigation family (`SET_NAV_ROUTING`, `SET_PUSH_STATE`, `HASH_REPLACE`,
`HASH_ATTACH_CHANGED`, `SET_APP_STATE_ACTIVE`) does **not** travel as
follow-up actions: the backend folds it into the one `ROUTER` system action
([CL] `follow_up_action`, [navigation.md](navigation.md#the-router-action)).
`HASH_BACK` is a follow-up action.

## Wired frontend actions

`_event_client( )`, or `follow_up_action( )` used as a view attribute, does
not queue anything: it writes a wire that runs the action in the browser on
the event, without a roundtrip ([CL] `follow_up_action`, `IF result IS
SUPPLIED`; [EV] `get_event_client`). The wire form is the UI5 profile's
`.eF('<ACTION>', <args>...)`
([../profiles/ui5.md](../profiles/ui5.md#event-wires)); the actions are the
same as above. `cs_event-popup_close` and `popover_close` are written as
`.eF('CONTROL_GLOBAL', 'VIEW_SLOTS', 'destroy', 'POPUP'|'POPOVER')` - one
teardown path for the frontend ([EV] `map_client_event`).
