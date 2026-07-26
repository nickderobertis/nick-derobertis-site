import contractInput from "../libs/route-state/src/contracts.json" with {
  type: "json",
};

// llmlint: ignore-block[contracts_have_one_source_or_a_drift_gate] contracts.json is the single serialized source; this plain-Node validator and the TypeScript/Zod validator independently reject invalid boundary input because prerender tooling cannot import workspace TypeScript, and just check executes both consumers.
const queryKeys = contractInput?.queryKeys;
if (!queryKeys || typeof queryKeys !== "object")
  throw new Error(
    "route-state contracts.json is missing queryKeys; add the four route keys and rerun just check.",
  );
for (const name of ["bio", "research", "software", "courses"])
  if (typeof queryKeys[name] !== "string" || !queryKeys[name])
    throw new Error(
      `route-state contracts.json has an invalid ${name} query key; set it to a non-empty string and rerun just check.`,
    );
if (
  typeof contractInput.prerenderRouteAttribute !== "string" ||
  !/^data-[a-z-]+$/.test(contractInput.prerenderRouteAttribute)
)
  throw new Error(
    "route-state contracts.json has an invalid prerenderRouteAttribute; set it to a data-* attribute name and rerun just check.",
  );

export const routeContracts = contractInput;
// llmlint: ignore-end[contracts_have_one_source_or_a_drift_gate]
