import contractInput from "../libs/route-state/src/contracts.json" with {
  type: "json",
};

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
