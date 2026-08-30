/**
 * A refusal this gate raises on purpose. Every message carries the action that
 * clears it, which is what lets the CLI tell a deliberate refusal apart from an
 * unexpected failure that needs a recovery step appended to it.
 */
export class BudgetRefusal extends Error {}

/**
 * @typedef {{measuredBytes: number, ceilingBytes: number}} Ceiling
 * @typedef {{entry: Ceiling, page?: Ceiling}} AppBudget
 * @typedef {{marginPercent: number, apps: Record<string, AppBudget>, routes: Record<string, Ceiling>}} BundleBudgets
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
  const { marginPercent, apps, routes } = value;
  if (
    typeof marginPercent !== "number" ||
    !Number.isFinite(marginPercent) ||
    marginPercent < 0
  )
    refuse("marginPercent must be a non-negative number");
  const readCeiling = (entry, label) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      refuse(`${label} must declare an object`);
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
    marginPercent,
    apps: readGroup(apps, "apps", (entry, label) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        refuse(`${label} must declare an object`);
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
