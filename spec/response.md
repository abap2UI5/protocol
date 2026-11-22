# Response body

Schema: [../schema/response.schema.json](../schema/response.schema.json).

## Shape

```json
{ "S_FRONT": {
    "ID": "982BD4B2BEBE4DEE93371A4671461244",
    "APP": "Z2UI5_CL_CONF_SLOTS",
    "PROTOCOL": 3,
    "VIEWS": {
      "MAIN": { "XML": "<mvc:View ...>...</mvc:View>" },
      "POPOVER": { "XML": "<core:FragmentDefinition ...>", "OPT": { "openById": "btn_popover" } },
      "POPUP": { "DESTROY": true }
    },
    "NAV": { "setNavRouting": "KEEP" },
    "ACTIONS": [["MESSAGE_TOAST", "show", "Saved"]] },
  "MODEL": { "NAME": "Ada", "T_ITEMS": [{ "ID": 1, "TEXT": "one", "DONE": false }] } }
```

The backend writes it in [H] `response_abap_to_json`; the UI5 frontend reads
it in [SRV] `readHttp` and [V1] `_processAfterRendering`.

**Implementation note.** The body is JSON text, so a control character
(U+0000 to U+001F) inside a string travels escaped. The reference's
serializer left some of them raw - a bound value holding U+0001 made the
browser's `JSON.parse` refuse the whole response; from abap2UI5 1.147.0 on
the handler escapes them as `\u00XX` in the finished text ([H]
`response_abap_to_json`).

## S_FRONT

| Key | Type | Meaning |
|---|---|---|
| `ID` | non-empty string | the draft the **next** request continues ([sessions.md](sessions.md)). A frontend MUST send it as `S_FRONT.ID` of its next request |
| `APP` | non-empty string | the class of the app that answered, upper case ([H] `main_end`). After a navigation it is the app navigated to |
| `PROTOCOL` | integer `3` | the wire version ([versioning.md](versioning.md)) |
| `VIEWS` | object | what becomes of the view slots ([below](#views)); absent when the response changes none |
| `NAV` | object | the browser-history intent of the response ([below](#nav)); absent when it has none |
| `ACTIONS` | array | the follow-up actions the app queued ([below](#actions)); absent when there are none |

- A backend MUST send `ID`, `APP` and `PROTOCOL` in every 2xx response
  ([H] `response_abap_to_json` stamps `PROTOCOL` on every response).
  *Checked by:* `response.id-and-app`, `response.protocol`.
- A backend SHOULD leave out a section that says nothing - the reference
  writes `VIEWS` and `NAV` only when they hold an entry and `ACTIONS` only
  when the app queued one ([H] `response_abap_to_json`,
  `actions_serialize`). A frontend MUST read an absent section as an empty
  one: no slot changes, no navigation intent, no action. *Checked by:*
  `response.model-absent-when-unchanged`. *Frontend check:*
  `response.no-actions`.
- A frontend MUST ignore keys it does not know (additive revisions,
  [versioning.md](versioning.md)) - in `S_FRONT`, at the root, in a slot's
  entry and its `OPT`, and in `NAV`. *Frontend check:*
  `response.unknown-keys`.

## Sections

The three sections say three different things, and a frontend reads each
at its own moment ([processing order](#processing-order)): `VIEWS` is what
the screen **is** after this roundtrip, `NAV` what the URL has to reflect,
`ACTIONS` what the frontend is asked to **do** once the screen stands. The
first two are the framework's - an app reaches them only through the
client API (`view_display( )`, `popup_destroy( )`, `nav_app_call( )`,
`hash_set( )`, ...) - the third is the app's own list.

### VIEWS

An object with one key per slot the response changes - `MAIN`, `NEST`,
`NEST2`, `POPUP`, `POPOVER` ([view slots](#view-slots)). A slot it does not
name stays as it is. An entry is one of two things, never both ([FE]
`slots_serialize`):

- **A display** - `{ "XML": <view>, "OPT": <options>? }` builds `<view>`
  into the slot, replacing whatever the slot holds ([FE] `slot_display`,
  [SL] `action`, `displayMain`, `displayStandalone`). The view is a string
  in the language of a view profile
  ([../profiles/](../profiles/README.md)); an empty string is still a
  display - the key `XML` says so ([FE] `slots_serialize`).
- **A teardown** - `{ "DESTROY": true }` takes the slot down ([FE]
  `slot_destroy`).

The options of a display:

| Option | Slot | Meaning |
|---|---|---|
| `id` | NEST, NEST2 | the id of the control (in MAIN, or in NEST for NEST2) that receives the nested view |
| `methodInsert` | NEST, NEST2 | the mutator that inserts it (`addItem`, `addContent`, ...) |
| `methodDestroy` | NEST, NEST2 | the mutator that clears the anchor first |
| `openById` | POPOVER | the id of the control the popover opens by |
| `switchDefaultModelPath`, `switchDefaultModelAnnoUri` | MAIN | an OData service installed as the view's default model; the app's model moves to the named model `http` (UI5 profile) |
| `transition`, `transitionBack` | MAIN | the page transition and its direction (UI5 profile) |
| `navBack` | MAIN | this view is reached by going back - a return to a stacked app ([navigation.md](navigation.md#the-app-stack)) |
| `appInstance` | MAIN | an opaque id of the app instance the view belongs to - tells a page change from a re-display |

An option the app did not set is absent, never an empty value, and `OPT`
is left out when no option is set ([FE] `set_opt_string`,
`slots_serialize`).

### NAV

The browser-history intent of this response, as one options object - the
routing mode, a history push for a `nav_app_call`, an app-owned hash to
write, the app-state hash ([FE] `nav_serialize`). The options and their
rules are in [navigation.md](navigation.md#the-nav-section).

### ACTIONS

The **follow-up actions** the app queued - messages, focus, timers, ...
([actions.md](actions.md)) - in the order it queued them. Every entry is a
**JSON array** whose first element names the action ([FE]
`build_global_call`, [EV] `get_event_client_ajson`, [H]
`actions_serialize`). The frontend runs them last, in order, once the
views are rendered ([V1] `_runPendingActions`, [FA] `runCustom`).
*Checked by:* every check that reads an action.

**Implementation note.** The UI5 frontend also accepts an action given as a
JSON *string* holding the array, so a skewed backend keeps working
([FA] `parseAction`). Backends send arrays; the schema requires them.

## View slots

| Slot | Shown by | Owns a model | Lives |
|---|---|---|---|
| `MAIN` | `view_display( )` | yes | the screen; NEST and NEST2 are inside it |
| `NEST` | `nest_view_display( )` | no - shares MAIN's | inserted into a control of MAIN |
| `NEST2` | `nest2_view_display( )` | no - shares MAIN's | inserted into a control of MAIN or NEST |
| `POPUP` | `popup_display( )` | yes | a dialog over MAIN |
| `POPOVER` | `popover_display( )` | yes | a popover anchored to a control |

POPUP and POPOVER are the **standalone** slots: they live outside MAIN's
control tree and do not fall with it by themselves. Two rules take them
down, and each has one owner - the side that can see the cause.

Rules for the backend ([FE] `slot_reset`, `slots_serialize`; [ACT]
`prepare_app_stack`, `factory_first_start`):

- `VIEWS` MUST say at most **one** thing per slot: the last call of the
  app decides (a second display replaces the first, a teardown after a
  display voids it, a display after a teardown replaces it). *Checked by:*
  `slots.popup-replace`.
- Views displayed into several slots in one roundtrip MUST travel each
  under its slot, whatever order the app called them in. The backend
  orders nothing - `VIEWS` is an object, and the order the slots are built
  in is the frontend's (below). *Checked by:* `slots.several`.
- A display needs no teardown before it: the frontend replaces what the
  slot holds.
- **An app switch takes the standalone slots down, and the backend says
  so.** A response of another app instance than the one the request
  continued - a `nav_app_call`, a `nav_app_leave`, the reserved leave
  event - MUST carry the teardown of POPUP and of POPOVER, each unless
  the app that takes the screen displays that slot in the same roundtrip
  ([ACT] `prepare_app_stack`: queued before the called app runs, so its
  own `popup_display( )` replaces the teardown through [FE]
  `slot_reset`). So MUST the response to an app start that names a class
  or a draft ([ACT] `factory_first_start`): on a page that already shows
  an app - Back/Forward restoring a route, a hash edited by hand - it is
  an app switch too, and on a page that has just loaded the teardowns
  find nothing. The backend is the one side that knows a hop happened:
  another instance of the **same** class looks like the same app from the
  browser. A roundtrip that stays in the app MUST NOT carry a teardown
  the app did not ask for. *Checked by:* `slots.hop-teardown`,
  `slots.start-teardown`.
- A teardown the app asks for next to a MAIN display travels like any
  other; it finds the slot already closed by the frontend's rule below.
- **Implementation note.** The reference's own start app, which answers
  a request that names nothing
  ([navigation.md](navigation.md#which-app-a-request-starts)), is created
  without the two teardowns ([ACT] `factory_system_startup`).

Rules for the frontend ([SL], [V1]):

- A frontend MUST apply the entries of `VIEWS` in **slot order** - MAIN,
  NEST, NEST2, POPUP, POPOVER - whatever order the keys arrive in, and
  one at a time: a nested view is inserted into MAIN, so MAIN has to be
  built first, and a popup of the same response opens over the new screen
  ([V1] `_applyViews`). *Frontend check:* `slots.order`.
- **A new MAIN view takes the standalone slots down, and the frontend
  does it.** A frontend MUST build a MAIN display as the new screen and
  tear down NEST, NEST2, POPUP and POPOVER with it; a popup or popover
  displayed in the same response opens after MAIN ([SL] `displayMain`).
  The backend neither relies on this rule nor repeats it.
- A frontend MUST leave a slot the response does not name as it is - also
  when the response names another `APP` than the one it rendered last:
  the teardown of an app switch is the backend's to say (above), not the
  frontend's to infer from the class name ([V1] `_processAfterRendering`).
  *Frontend check:* `slots.app-change`.
- A frontend that cannot render a slot (a portable renderer without NEST,
  [../profiles/portable.md](../profiles/portable.md#2-documents-slots-and-namespaces))
  MUST still process the entry without failing the roundtrip.
- *Frontend checks:* `slots.main`, `slots.popup`, `slots.popover`,
  `slots.popover-over-main`, `slots.main-tears-down`,
  `slots.nest-processed`, `ui5.nest`, `portable.view-replaced`.

*Checked by:* `response.start-displays-main`, `response.rerender`,
`slots.popup-display`, `slots.popup-destroy`, `slots.popover`, `slots.nest`,
`slots.nest2`.

## MODEL

`MODEL` is the **complete** view model of the app that answered: every
attribute the app has bound with `_bind( )`, keyed by its upper-case name,
as JSON ([H] `main_end`, [MOD] `main_json_stringify`). It is never a delta.

| ABAP type | JSON |
|---|---|
| character-like (`string`, `c`, `n`), `d`, `t` | string (`d` and `t` as written by the serializer) |
| `i`, `int8`, `p`, `decfloat`, `f` | number |
| `abap_bool` | `true` / `false` |
| structure | object, components upper case |
| table | array of rows |

When it travels:

- A response that displays a view in any slot MUST carry the model -
  unless the app binds nothing at all, in which case the key is left out
  (an empty model is not sent, [H] `response_abap_to_json`).
- A response to a roundtrip in which the app changed bound data without
  displaying anything MUST carry the model - the automatic push; the
  backend compares the model before and after `main( )` ([H] `main_process`,
  `main_end`). *Checked by:* `response.model-push`.
- A response to a roundtrip that changed nothing bound SHOULD leave `MODEL`
  out - most roundtrips are of that kind. *Checked by:*
  `response.model-absent-when-unchanged`.
- Only bound attributes appear; an attribute the app does not bind stays
  on the server. *Checked by:* `nav.call`.
- A **windowed table** travels as the app holds it - the rows it has
  loaded - and the reserved key `__WINDOW` carries its state next to it
  ([windowed-tables.md](windowed-tables.md#the-window-state)). *Checked
  by:* `window.first-window`, `window.app-event`.
- *Checked by:* `response.model-types`, `model.table-grows`.

A frontend:

- MUST read an absent `MODEL` as "unchanged": keep its model, including
  what the user typed and has not sent.
- MUST, when `MODEL` is present, give it to every open slot that owns a
  model **and belongs to the app that answered**, after the views of
  `VIEWS` were applied - not to a slot that holds another app's view (the
  caller's page behind a popup app keeps its model, [SL]
  `updateModelIfRequired`).
- SHOULD re-apply edits made while the roundtrip was in flight and not yet
  sent ([SRV] `_clearSentPaths`): only what the won request carried is
  done with.
- *Frontend checks:* `model.absent-keeps`, `model.push`,
  `model.push-own-app`, `model.pending-survive-push`.

## Processing order

What the UI5 frontend does with one adopted response ([SRV] `readHttp`,
`responseSuccess`, [V1] `_processAfterRendering`), and what every rendering
frontend SHOULD do:

1. Check `PROTOCOL` ([versioning.md](versioning.md)); a mismatch ends here.
2. Adopt `ID`, `APP` and `MODEL`.
3. Apply `VIEWS` in slot order, waiting for each view to be built
   ([V1] `_applyViews`).
4. Push `MODEL` into the open model-owning slots of the answering app.
5. Synchronise the URL once - with the options of `NAV` when the response
   has the section, with the response's `ID` either way
   ([navigation.md](navigation.md#the-nav-section)).
6. Run `ACTIONS` in order, once the views are rendered (a focus needs its
   control in the DOM); an action that returns a promise is awaited
   ([V1] `_runPendingActions`).
7. Send what was kept while the roundtrip ran, one roundtrip at a time
   ([V1] `_dispatchQueuedEvent`): the oldest event a control fired while
   its view was being built, then the event a queue-last wire kept, then
   the window requests of windowed tables, which are kept per table
   ([SL] `keepWindowRequest`, `dispatchQueuedWindows`; a request for more
   rows does not replace a kept `SORT` or `FILTER` of the same table, [WM]
   `keepRestart`).

A response that a newer request superseded is dropped whole; its own
follow-up actions still run when its screen is still the one shown
([V1] `_processAfterRendering`).

**Implementation note.** An event a control fires from its own rendering
- a storage control answering with the value it found, an `afterRendering`
an app wired - arrives while the response that builds its view is still
being processed, and so while the frontend is busy. The UI5 frontend keeps
such an event, whatever its wire's flags, and sends the kept ones after
the response, one per landed roundtrip in the order they fired ([V1] `eB`,
`_firedWhileBuilding`, `_dispatchQueuedEvent`). An app that answers a
rendering event with a view that fires it again would loop: an unbroken
run of 25 such events ends with a log line and the rest dropped ([V1]
`RENDER_EVENT_CHAIN_MAX`). The first roundtrip of a page is busy like
every other. With a response of another `APP` the kept events, the
queue-last event and the kept window requests are dropped - they came
from the leaving app's views ([V1] `_processAfterRendering`).
