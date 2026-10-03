// Every check of the frontend suite, in the order they run (and report).
import request from "./request.mjs";
import transport from "./transport.mjs";
import model from "./model.mjs";
import response from "./response.mjs";
import actions from "./actions.mjs";
import navigation from "./navigation.mjs";
import errors from "./errors.mjs";
import portable from "./portable.mjs";
import ui5 from "./ui5.mjs";
import semantic from "./semantic.mjs";

export const ALL_FRONTEND_CHECKS = Object.freeze([
  ...request, ...transport, ...model, ...response, ...actions, ...navigation, ...errors,
  ...portable, ...ui5, ...semantic,
]);
