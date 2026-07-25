import { cvDataClient, type SoftwareProject } from "@site/data-access-core";
import {
  parseRouteView,
  type RouteView,
  routeStateQueryKeys,
} from "@site/route-state";

export function useSoftwarePage(
  initialView?: RouteView,
  initialProjects?: SoftwareProject[],
) {
  const requestedView =
    initialView ??
    (typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get(
          routeStateQueryKeys.software,
        ));
  return {
    projects: initialProjects ?? cvDataClient.domain("software_projects"),
    view: parseRouteView(requestedView),
  };
}
