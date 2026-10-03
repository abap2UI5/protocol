// Every check of the backend suite, in the order they run (and report).
import transport from "./transport.mjs";
import response from "./response.mjs";
import events from "./events.mjs";
import model from "./model.mjs";
import messages from "./messages.mjs";
import slots from "./slots.mjs";
import actions from "./actions.mjs";
import navigation from "./navigation.mjs";
import sessions from "./sessions.mjs";
import errors from "./errors.mjs";
import ui5 from "./ui5.mjs";

export const ALL_CHECKS = Object.freeze([
  ...transport, ...response, ...events, ...model, ...messages, ...slots, ...actions,
  ...navigation, ...sessions, ...errors, ...ui5,
]);
