import { cvDataClient, type SoftwareProject } from "@site/data-access-core";
import { parseRouteView, type RouteView } from "@site/route-state";

export function useSoftwarePage(
  initialView?: RouteView,
  initialProjects?: SoftwareProject[],
) {
  const requestedView =
    initialView ??
    (typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get("software-view"));
  return {
    projects: initialProjects ?? cvDataClient.domain("software_projects"),
    view: parseRouteView(requestedView),
  };
}
