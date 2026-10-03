/*
 * A JSON Schema (draft 2020-12) validator for the subset the protocol's
 * schemas use - no dependency, so the suite stays installable anywhere.
 * test/schema.test.mjs runs every recorded message through this validator
 * AND through ajv (a devDependency) and requires the two to agree.
 *
 * Supported: true/false schemas, type, const, enum, properties, required,
 * additionalProperties, propertyNames, minProperties, items, prefixItems,
 * minItems, maxItems, minLength, maxLength, pattern, minimum, allOf, anyOf,
 * oneOf, not, if/then/else, $ref to "#/$defs/<name>". Annotations
 * (title, description, $id, $schema) are ignored. Anything else throws, so a
 * schema can never use a keyword this validator would silently skip.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../schema");

const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "$comment", "examples", "default", "$defs"]);
const KNOWN = new Set([
  "type", "const", "enum", "properties", "required", "additionalProperties", "propertyNames",
  "minProperties", "items", "prefixItems", "minItems", "maxItems", "minLength", "maxLength",
  "pattern", "minimum", "allOf", "anyOf", "oneOf", "not", "if", "then", "else", "$ref",
]);

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(t, v) {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  return t === actual;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

const ptr = (base, key) => `${base}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;

/** Compile a root schema into a validate(instance) -> { valid, errors[] } function. */
export function compile(root) {
  const resolve = (ref) => {
    const m = /^#\/\$defs\/([^/]+)$/.exec(ref);
    if (!m || !root.$defs || !(m[1] in root.$defs)) throw new Error(`unsupported or unknown $ref ${ref}`);
    return root.$defs[m[1]];
  };

  function check(schema, v, at, errors) {
    if (schema === true) return;
    if (schema === false) {
      errors.push({ path: at, message: "is not allowed here" });
      return;
    }
    for (const k of Object.keys(schema)) {
      if (!KNOWN.has(k) && !ANNOTATIONS.has(k)) throw new Error(`unsupported schema keyword "${k}"`);
    }
    if (schema.$ref) check(resolve(schema.$ref), v, at, errors);
    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((t) => typeMatches(t, v))) {
        errors.push({ path: at, message: `must be ${types.join(" or ")}, is ${typeOf(v)}` });
        return;
      }
    }
    if ("const" in schema && !deepEqual(schema.const, v)) {
      errors.push({ path: at, message: `must be ${JSON.stringify(schema.const)}, is ${JSON.stringify(v)}` });
    }
    if (schema.enum && !schema.enum.some((e) => deepEqual(e, v))) {
      errors.push({ path: at, message: `must be one of ${JSON.stringify(schema.enum)}, is ${JSON.stringify(v)}` });
    }
    const t = typeOf(v);
    if (t === "string") {
      if (schema.minLength !== undefined && [...v].length < schema.minLength) errors.push({ path: at, message: `must have at least ${schema.minLength} character(s)` });
      if (schema.maxLength !== undefined && [...v].length > schema.maxLength) errors.push({ path: at, message: `must have at most ${schema.maxLength} character(s)` });
      if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(v)) errors.push({ path: at, message: `must match ${schema.pattern}` });
    }
    if ((t === "number" || t === "integer") && schema.minimum !== undefined && v < schema.minimum) {
      errors.push({ path: at, message: `must be >= ${schema.minimum}` });
    }
    if (t === "object") {
      const keys = Object.keys(v);
      if (schema.minProperties !== undefined && keys.length < schema.minProperties) errors.push({ path: at, message: `must have at least ${schema.minProperties} propert(ies)` });
      for (const r of schema.required || []) {
        if (!Object.prototype.hasOwnProperty.call(v, r)) errors.push({ path: at, message: `must have property "${r}"` });
      }
      const props = schema.properties || {};
      for (const k of keys) {
        if (schema.propertyNames !== undefined) check(schema.propertyNames, k, ptr(at, k), errors);
        if (Object.prototype.hasOwnProperty.call(props, k)) check(props[k], v[k], ptr(at, k), errors);
        else if (schema.additionalProperties !== undefined) check(schema.additionalProperties, v[k], ptr(at, k), errors);
      }
    }
    if (t === "array") {
      if (schema.minItems !== undefined && v.length < schema.minItems) errors.push({ path: at, message: `must have at least ${schema.minItems} item(s)` });
      if (schema.maxItems !== undefined && v.length > schema.maxItems) errors.push({ path: at, message: `must have at most ${schema.maxItems} item(s)` });
      const prefix = schema.prefixItems || [];
      v.forEach((item, i) => {
        if (i < prefix.length) check(prefix[i], item, ptr(at, i), errors);
        else if (schema.items !== undefined) check(schema.items, item, ptr(at, i), errors);
      });
    }
    for (const s of schema.allOf || []) check(s, v, at, errors);
    if (schema.anyOf && !schema.anyOf.some((s) => ok(s, v))) {
      errors.push({ path: at, message: "matches none of the allowed shapes (anyOf)" });
    }
    if (schema.oneOf) {
      const n = schema.oneOf.filter((s) => ok(s, v)).length;
      if (n !== 1) errors.push({ path: at, message: `must match exactly one shape (oneOf), matches ${n}` });
    }
    if (schema.not !== undefined && ok(schema.not, v)) errors.push({ path: at, message: "matches a forbidden shape (not)" });
    if (schema.if !== undefined) {
      if (ok(schema.if, v)) {
        if (schema.then !== undefined) check(schema.then, v, at, errors);
      } else if (schema.else !== undefined) {
        check(schema.else, v, at, errors);
      }
    }
  }

  function ok(schema, v) {
    const errors = [];
    check(schema, v, "", errors);
    return errors.length === 0;
  }

  return (instance) => {
    const errors = [];
    check(root, instance, "", errors);
    return { valid: errors.length === 0, errors };
  };
}

const cache = new Map();

/** The schema file `name` (request, response, snapshot) of this repository, parsed. */
export function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), "utf8"));
}

/** validate(name, instance) against schema/<name>.schema.json. */
export function validate(name, instance) {
  if (!cache.has(name)) cache.set(name, compile(loadSchema(name)));
  return cache.get(name)(instance);
}

/** The errors as one line each: "<path>: <message>". */
export function formatErrors(errors, max = 5) {
  const shown = errors.slice(0, max).map((e) => `${e.path || "(root)"}: ${e.message}`);
  if (errors.length > max) shown.push(`... ${errors.length - max} more`);
  return shown.join("; ");
}
