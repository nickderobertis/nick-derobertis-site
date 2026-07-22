import contractInput from "../libs/route-state/src/contracts.json" with {
  type: "json",
};

const queryKeys = contractInput?.queryKeys;
if (
  !queryKeys ||
  ["bio", "research", "software", "courses"].some(
    (name) => typeof queryKeys[name] !== "string" || !queryKeys[name],
  ) ||
  typeof contractInput.prerenderRouteAttribute !== "string" ||
  !/^data-[a-z-]+$/.test(contractInput.prerenderRouteAttribute)
)
  throw new Error(
    "The route-state contract is invalid; fix libs/route-state/src/contracts.json and rerun just check.",
  );

export const routeContracts = contractInput;
