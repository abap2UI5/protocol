/*
 * The way back: an Action.Submit payload of a card rendered by render.mjs ->
 * the next protocol request (spec/request.md). An Adaptive Cards host
 * submits the action's `data` merged with the values of the card's inputs,
 * keyed by input id - and the ids are binding paths. The step itself is
 * shared with the terminal renderer and lives in ../common/request.mjs.
 */
export { submitToRequest, eventRequest, startRequest, coerce, inputsOf } from "../common/request.mjs";
