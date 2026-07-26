import {
  parseRouteView,
  type RouteView,
  routeStateQueryKeys,
} from "@site/route-state";
import { useEffect, useState } from "react";

export function useBioView(initialView?: RouteView): RouteView {
  const [view, setView] = useState<RouteView>(() =>
    parseRouteView(
      initialView ??
        (typeof window === "undefined"
          ? undefined
          : new URLSearchParams(window.location.search).get(
              routeStateQueryKeys.bio,
            )),
    ),
  );
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return view;
}
