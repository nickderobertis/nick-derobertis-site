import type { SoftwareProject } from "@site/data-access-core";
import { softwareProjects } from "@site/data-access-software";
import type { RouteView } from "@site/route-state";
import { useEffect, useState } from "react";

export function useSoftwarePage(
  initialView?: RouteView,
  initialProjects?: SoftwareProject[],
) {
  const [view, setView] = useState<RouteView>(initialView ?? "default");
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return {
    projects: initialProjects ?? softwareProjects,
    view,
  };
}
