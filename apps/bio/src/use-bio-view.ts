import {
  parseRouteView,
  type RouteView,
  routeStateQueryKeys,
} from "@site/route-state";

export function useBioView(initialView?: RouteView): RouteView {
  const requestedView =
    initialView ??
    (typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get(
          routeStateQueryKeys.bio,
        ));
  return parseRouteView(requestedView);
}
