import { runInNewContext } from "node:vm";

/**
 * A refusal this gate raises on purpose. Every message carries the action that
 * clears it, which is what lets the CLI tell a deliberate refusal apart from an
 * unexpected failure that needs a recovery step appended to it.
 */
export class BudgetRefusal extends Error {}

// llmlint: ignore-file[changed_behavior_has_e2e] This module has no browser
// interface: it is the boundary a committed build input is read through, it
// runs inside shell:prerender, and a file it refuses fails that lane before
// compose can assemble an artifact, so nothing it accepts or rejects is
// something a visitor could observe. bundle-budgets.spec.ts drives every
// refusal it raises through the real gate CLI as a subprocess, over isolated
// artifact fixtures and over budget files with an app removed, a property
// nothing reads, and prose that is not prose; site.spec.ts drives the artifact
// it passes in a real browser with and without JavaScript.

/**
 * @typedef {{measuredBytes: number, ceilingBytes: number}} Ceiling
 * @typedef {{entry: Ceiling, page?: Ceiling}} AppBudget
 * @typedef {{derivation?: string[], marginPercent: number, apps: Record<string, AppBudget>, routes: Record<string, Ceiling>}} BundleBudgets
 */

/**
 * The committed budgets, validated at the boundary that reads them. Everything
 * downstream — the gate, and the spec that proves the gate — reaches the file
 * through this one function, so neither works from a shape nothing checked.
 *
 * @param {unknown} value the parsed contents of the budget file
 * @param {string} path where those contents were read from, for diagnostics
 * @returns {BundleBudgets}
 */
export function parseBundleBudgets(value, path) {
  const refuse = (detail) => {
    throw new BudgetRefusal(
      `${path} is invalid: ${detail}. Fix the committed budgets and rerun just prerender.`,
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    refuse("it must contain an object");
  // What --rederive writes back is what this function returns, so every property
  // the file carries, at every level of it, has to be read here or refused
  // here: one that is neither would be copied into the rewritten file as though
  // a boundary had checked it.
  const onlyReads = (object, label, read) => {
    const unread = Object.keys(object).filter((key) => !read.includes(key));
    if (unread.length > 0)
      refuse(
        `${label} declares ${unread.join(", ")}, which nothing here reads; it may declare only ${read.join(", ")}`,
      );
  };
  onlyReads(value, "it", ["derivation", "marginPercent", "apps", "routes"]);
  const { derivation, marginPercent, apps, routes } = value;
  // The prose recording how these ceilings were derived is optional, because a
  // budget file assembled for one gate run carries none, but a file that does
  // carry it is rewritten with it, so it is read rather than passed through.
  if (
    derivation !== undefined &&
    (!Array.isArray(derivation) ||
      derivation.length === 0 ||
      derivation.some((note) => typeof note !== "string" || note.length === 0))
  )
    refuse("derivation, when present, must be an array of non-empty strings");
  if (
    typeof marginPercent !== "number" ||
    !Number.isFinite(marginPercent) ||
    marginPercent < 0
  )
    refuse("marginPercent must be a non-negative number");
  const readCeiling = (entry, label) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      refuse(`${label} must declare an object`);
    onlyReads(entry, label, ["measuredBytes", "ceilingBytes"]);
    const { measuredBytes, ceilingBytes } = entry;
    for (const [field, bytes] of [
      ["measuredBytes", measuredBytes],
      ["ceilingBytes", ceilingBytes],
    ])
      if (!Number.isInteger(bytes) || bytes < 0)
        refuse(`${label} ${field} must be a non-negative integer`);
    // One margin covers every ceiling in the file, so a ceiling cannot be
    // widened for a single app or route to make room for a regression there.
    const derived = deriveCeiling(measuredBytes, marginPercent).ceilingBytes;
    if (ceilingBytes !== derived)
      refuse(
        `${label} declares a ${ceilingBytes}-byte ceiling, but ${measuredBytes} bytes at the ${marginPercent}% margin derives ${derived}`,
      );
    return { measuredBytes, ceilingBytes };
  };
  const readGroup = (group, label, shape) => {
    if (!group || typeof group !== "object" || Array.isArray(group))
      refuse(`${label} must declare an object`);
    return Object.fromEntries(
      Object.entries(group).map(([key, entry]) => [
        key,
        shape(entry, `${label} ${key}`),
      ]),
    );
  };
  return {
    ...(derivation === undefined ? {} : { derivation }),
    marginPercent,
    apps: readGroup(apps, "apps", (entry, label) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        refuse(`${label} must declare an object`);
      onlyReads(entry, label, ["entry", "page"]);
      const budget = { entry: readCeiling(entry.entry, `${label} entry`) };
      return "page" in entry
        ? { ...budget, page: readCeiling(entry.page, `${label} ./Page`) }
        : budget;
    }),
    routes: readGroup(routes, "routes", readCeiling),
  };
}

/**
 * The ceiling a measurement earns at the file's one margin. Both the gate that
 * checks a committed ceiling and the mode that rewrites one derive it here, so
 * a re-derived file cannot disagree with the check that reads it back.
 *
 * @param {number} measuredBytes
 * @param {number} marginPercent
 * @returns {Ceiling}
 */
export function deriveCeiling(measuredBytes, marginPercent) {
  return {
    measuredBytes,
    ceilingBytes: Math.ceil(measuredBytes * (1 + marginPercent / 100)),
  };
}

/**
 * The resolver expression, checked before it is evaluated rather than after.
 * It comes out of a build artifact, so what may be executed is stated here as a
 * shape: an arrow function of one parameter whose body, once its string
 * literals are removed, names nothing but that parameter. That admits the
 * concatenations and chunk-id maps a bundler emits — `e=>"common.9f2.js"`,
 * `e=>""+({5:"a"})[e]+".js"` — and refuses anything that could call out to a
 * host global, so nothing unvalidated ever reaches runInNewContext.
 */
function validatedResolverExpression(expression) {
  const refuse = (detail) => {
    throw new BudgetRefusal(
      `A bundle runtime declares a chunk filename resolver that ${detail}. Rebuild the artifact and rerun just prerender.`,
    );
  };
  if (expression.length > 8192) refuse("is longer than any bundler emits");
  const arrow = /^\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>([\s\S]*)$/.exec(
    expression,
  );
  const [, parameter = "", body = ""] = arrow ?? [];
  if (!parameter) refuse("is not an arrow function of one parameter");
  if (body.includes("`")) refuse("interpolates a template literal");
  const withoutStrings = body
    .replace(/"(?:[^"\\]|\\.)*"/g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "");
  for (const [name] of withoutStrings.matchAll(/[A-Za-z_$][\w$]*/g))
    if (name !== parameter) refuse(`reads ${name}, which is not its parameter`);
  // Naming nothing but the parameter is not enough on its own: a string
  // literal is removed above, so `e["constructor"]("…")()` would reach the
  // evaluator naming only `e`. What a bundler actually writes never opens a
  // bracket after a name — it groups after `+` and indexes the object literal
  // it just closed — so each opener is required to sit where those do.
  for (const [, before, opener] of withoutStrings.matchAll(/(\S)\s*([([])/g)) {
    if (opener === "(" && !"+(?:,".includes(before))
      refuse("calls something rather than only grouping a concatenation");
    if (opener === "[" && !")}".includes(before))
      refuse("indexes a value that is not the object literal before it");
  }
  return expression;
}

/**
 * Reads the chunk-id-to-filename function a bundle's own runtime carries.
 * Which file a chunk id names is the bundler's decision, not a naming
 * convention: an id can be renamed (`5` becomes `common`), can carry no
 * JavaScript at all, and the mapping changes shape with the chunks a build
 * emits. So the id is resolved with the very function the browser resolves it
 * with, extracted by scanning the expression's own brackets rather than by
 * guessing where it ends.
 */
export function chunkFileResolver(source) {
  const marker = "__webpack_require__.u=";
  const start = source.indexOf(marker);
  if (start === -1) return undefined;
  let index = start + marker.length;
  let depth = 0;
  let quote = "";
  for (; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && (character === ";" || character === ",")) break;
  }
  const expression = validatedResolverExpression(
    source.slice(start + marker.length, index),
  );
  const resolve = runInNewContext(`(${expression})`, Object.create(null), {
    timeout: 1000,
  });
  if (typeof resolve !== "function")
    throw new BudgetRefusal(
      `A bundle runtime declares a chunk filename resolver that is not a function. Rebuild the artifact and rerun just prerender.`,
    );
  return (id) => {
    const file = resolve(id);
    return typeof file === "string" ? file : undefined;
  };
}

/**
 * Every chunk id a bundle asks its runtime to fetch. A chunk that belongs to
 * another container resolves to a filename this app never emitted, and is
 * dropped below rather than counted against this app's budget.
 */
// llmlint: ignore-block[boundary_inputs_validated] This finds the chunk requests
// a bundle makes; it is not a boundary that admits or refuses one. What it does
// not match is not a malformed request but the rest of the bundle — minified
// application code, string data, the runtime's own scaffolding — so there is
// nothing here to refuse. Every id it does yield is validated where it is used:
// resolved by the bundle's own checked resolver, then required to name a file
// the app emitted before a byte of it is counted.
export function requestedChunkIds(source) {
  return [...source.matchAll(/\.e\("([^"\\]{1,32})"\)/g)].flatMap(([, id]) =>
    id === undefined ? [] : [id],
  );
}
// llmlint: ignore-end[boundary_inputs_validated]

/**
 * The chunks a host has to fetch to render one of this container's exposes,
 * read from the container's own expose module map — the same map the Module
 * Federation runtime reads when a host imports `<remote>/Page`.
 */
export function exposedChunkIds(container, expose) {
  const moduleMap = /moduleMap:\{([\s\S]*?)\},shareScope/.exec(container)?.[1];
  if (moduleMap === undefined) return undefined;
  const entry = moduleMap
    .split(/(?="\.\/)/)
    .find((segment) => segment.startsWith(`"${expose}":`));
  return entry === undefined ? undefined : requestedChunkIds(entry);
}
