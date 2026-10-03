# Response body

Schema: [../schema/response.schema.json](../schema/response.schema.json).

## Shape

```json
{ "S_FRONT": {
    "ID": "982BD4B2BEBE4DEE93371A4671461244",
    "APP": "Z2UI5_CL_CONF_SLOTS",
    "PROTOCOL": 2,
    "S_ACTION": {
      "T_SYSTEM": [
        ["VIEW_SLOTS", "display", "MAIN", "<mvc:View ...>...</mvc:View>"],
        ["VIEW_SLOTS", "display", "POPOVER", "<core:FragmentDefinition ...>", { "openById": "btn_popover" }],
        ["ROUTER", "sync", { "setNavRouting": "KEEP" }]
      ],
      "T_CUSTOM": [["MESSAGE_TOAST", "show", "Saved"]]
    } },
  "MODEL": { "NAME": "Ada", "T_ITEMS": [{ "ID": 1, "TEXT": "one", "DONE": false }] } }
```

The backend writes it in [H] `response_abap_to_json`; the UI5 frontend reads
it in [SRV] `readHttp` and [V1] `_processAfterRendering`.

## S_FRONT

| Key | Type | Meaning |
|---|---|---|
| `ID` | non-empty string | the draft the **next** request continues ([sessions.md](sessions.md)). A frontend MUST send it as `S_FRONT.ID` of its next request |
| `APP` | non-empty string | the class of the app that answered, upper case ([H] `main_end`). After a navigation it is the app navigated to |
| `PROTOCOL` | integer `2` | the wire version ([versioning.md](versioning.md)) |
| `S_ACTION` | object | the two action queues; absent when both are empty |

- A backend MUST send `ID`, `APP` and `PROTOCOL` in every 2xx response
  ([H] `response_abap_to_json` stamps `PROTOCOL` on every response).
  *Checked by:* `response.id-and-app`, `response.protocol`.
- A backend SHOULD leave out empty values (an empty queue, an absent
  `S_ACTION`) - the reference filters empty values before it adds the
  queues ([H] `response_abap_to_json`). A frontend MUST read an absent
  queue as an empty one.
- A frontend MUST ignore keys it does not know (additive revisions,
  [versioning.md](versioning.md)).

## Action queues

`S_ACTION` holds two arrays of actions. Every action is a **JSON array**
whose first element names it ([FE] `build_global_call`, [EV]
`get_event_client_ajson`):

- `T_SYSTEM` - **system actions**: the framework's view lifecycle
  (`VIEW_SLOTS`) and browser history (`ROUTER`). The frontend runs them
  first, in order, before anything the app queued, and waits for each view
  to be built before the next one runs ([V1] `_runSystemActions`).
- `T_CUSTOM` - **follow-up actions** the app queued: messages, focus,
  timers, ... ([actions.md](actions.md)). The frontend runs them last, in
  order, once the views are rendered ([V1] `_runPendingCustomJs`).

The two queues share one format and one dispatcher ([FA]); only the phase
differs. *Checked by:* every check that reads an action.

**Implementation note.** The UI5 frontend also accepts an action given as a
JSON *string* holding the array, so a skewed backend keeps working
([FA] `runSystem`, `runCustom`). Protocol 2 backends send arrays; the
schema requires them.

## System actions

### VIEW_SLOTS display

`["VIEW_SLOTS", "display", <slot>, <view>, <options>?]` builds `<view>` into
`<slot>`, replacing whatever the slot holds ([FE] `slot_display`, [SL]
`display`). The view is a string in the language of a view profile
([../profiles/](../profiles/README.md)); the options are:

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

An option the app did not set is absent, never an empty value
([FE] `set_opt_string`).

### VIEW_SLOTS destroy

`["VIEW_SLOTS", "destroy", <slot>]` tears the slot down ([FE] `slot_destroy`).

### ROUTER sync

`["ROUTER", "sync", <options>]` - the browser-history intent of this
response; see [navigation.md](navigation.md#the-router-action).

## View slots

| Slot | Shown by | Owns a model | Lives |
|---|---|---|---|
| `MAIN` | `view_display( )` | yes | the screen; NEST and NEST2 are inside it |
| `NEST` | `nest_view_display( )` | no - shares MAIN's | inserted into a control of MAIN |
| `NEST2` | `nest2_view_display( )` | no - shares MAIN's | inserted into a control of MAIN or NEST |
| `POPUP` | `popup_display( )` | yes | a dialog over MAIN |
| `POPOVER` | `popover_display( )` | yes | a popover anchored to a control |

Rules for the backend ([FE] `slot_reset`, `slots_serialize`):

- A response MUST carry at most **one** lifecycle action per slot: the last
  call of the app decides (a second display replaces the first, a destroy
  after a display voids it). *Checked by:* `slots.popup-replace`.
- The actions MUST leave in **slot order** - MAIN, NEST, NEST2, POPUP,
  POPOVER - whatever order the app called them in: a nested view is
  inserted into MAIN, so MAIN has to be built first. *Checked by:*
  `slots.order`.
- A display needs no destroy before it: the frontend tears the slot down
  itself.
- With a MAIN display, a destroy of POPUP or POPOVER is dropped - the
  frontend takes the standalone slots down with a new MAIN view anyway; a
  *display* of them in the same response still opens.

Rules for the frontend ([SL], [V1]):

- A frontend MUST build a MAIN display as the new screen and tear down NEST,
  NEST2, POPUP and POPOVER with it (a popup displayed in the same response
  opens after MAIN).
- A frontend MUST tear down POPUP and POPOVER when a response names
  another `APP` than the one it rendered last; the backend queues the
  destroys itself only for a hop between two instances of the **same**
  class, which the frontend cannot see ([ACT] `prepare_app_stack`).
- A frontend that cannot render a slot (a portable renderer without NEST,
  [../profiles/portable.md](../profiles/portable.md#2-documents-slots-and-namespaces))
  MUST still process the action without failing the roundtrip.

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
- *Checked by:* `response.model-types`, `model.table-grows`.

A frontend:

- MUST read an absent `MODEL` as "unchanged": keep its model, including
  what the user typed and has not sent.
- MUST, when `MODEL` is present, give it to every open slot that owns a
  model **and belongs to the app that answered**, after the system actions
  ran - not to a slot that holds another app's view (the caller's page
  behind a popup app keeps its model, [SL] `updateModelIfRequired`).
- SHOULD re-apply edits made while the roundtrip was in flight and not yet
  sent ([SRV] `_clearSentPaths`).

## Processing order

What the UI5 frontend does with one adopted response ([SRV] `readHttp`,
`responseSuccess`, [V1] `_processAfterRendering`), and what every rendering
frontend SHOULD do:

1. Check `PROTOCOL` ([versioning.md](versioning.md)); a mismatch ends here.
2. Adopt `ID`, `APP` and `MODEL`; when `APP` changed, tear down POPUP and
   POPOVER.
3. Run `T_SYSTEM` in order, waiting for each view to be built.
4. Push `MODEL` into the open model-owning slots of the answering app.
5. Synchronise the URL once - with the `ROUTER` options when the response
   had them, with the response's `ID` either way
   ([navigation.md](navigation.md#the-router-action)).
6. Run `T_CUSTOM` in order, once the views are rendered (a focus needs its
   control in the DOM); an action that returns a promise is awaited.
7. Send the event a queue-last wire kept during the roundtrip, if any.

A response that a newer request superseded is dropped whole; its own
follow-up actions still run when its screen is still the one shown
([V1] `_processAfterRendering`, the comment on the first roundtrip).
