import contractInput from "../libs/route-state/src/contracts.json" with {
  type: "json",
};

// llmlint: ignore-block[contracts_have_one_source_or_a_drift_gate] contracts.json is the single serialized source; this plain-Node validator and the TypeScript/Zod validator independently reject invalid boundary input because prerender tooling cannot import workspace TypeScript, and just check executes both consumers.
if (
  typeof contractInput.prerenderRouteAttribute !== "string" ||
  !/^data-[a-z-]+$/.test(contractInput.prerenderRouteAttribute)
)
  throw new Error(
    "route-state contracts.json has an invalid prerenderRouteAttribute; set it to a data-* attribute name and rerun just check.",
  );

export const routeContracts = contractInput;
// llmlint: ignore-end[contracts_have_one_source_or_a_drift_gate]

export function parseRemoteManifest(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((name) => !/^[a-z][a-z0-9-]*$/.test(name)) ||
    Object.values(value).some((alias) => typeof alias !== "string")
  )
    throw new Error(
      "The canonical remote manifest must contain valid string mappings; fix libs/build-config/src/remotes.json and rerun just check.",
    );
  return value;
}
