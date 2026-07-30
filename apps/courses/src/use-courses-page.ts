import { type Course, cvDataClient } from "@site/data-access-core";
import type { RouteView } from "@site/route-state";
import { useEffect, useState } from "react";

export function useCoursesPage(
  initialView?: RouteView,
  initialCourses?: Course[],
) {
  const [view, setView] = useState<RouteView>(initialView ?? "default");
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return {
    courses: initialCourses ?? cvDataClient.domain("courses"),
    view,
  };
}
