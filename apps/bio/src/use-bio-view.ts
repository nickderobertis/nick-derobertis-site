import { parseRouteView, type RouteView } from "@site/route-state";

export function useBioView(initialView?: RouteView): RouteView {
  const requestedView =
    initialView ??
    (typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get("bio-view"));
  return parseRouteView(requestedView);
}
