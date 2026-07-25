import { cvDataClient, type SoftwareProject } from "@site/data-access-core";
import {
  parseRouteView,
  type RouteView,
  routeStateQueryKeys,
} from "@site/route-state";
import { useEffect, useState } from "react";

export function useSoftwarePage(
  initialView?: RouteView,
  initialProjects?: SoftwareProject[],
) {
  const [view, setView] = useState<RouteView>(() =>
    parseRouteView(
      initialView ??
        (typeof window === "undefined"
          ? undefined
          : new URLSearchParams(window.location.search).get(
              routeStateQueryKeys.software,
            )),
    ),
  );
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return {
    projects: initialProjects ?? cvDataClient.domain("software_projects"),
    view,
  };
}
