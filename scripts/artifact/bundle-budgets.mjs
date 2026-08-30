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
