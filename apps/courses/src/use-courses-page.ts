import type { Course } from "@site/data-access-core";
import { courses } from "@site/data-access-courses";
import type { RouteView } from "@site/route-state";
import { useEffect, useState } from "react";

export function useCoursesPage(
  initialView?: RouteView,
  initialCourses?: Course[],
) {
  const [view, setView] = useState<RouteView>(initialView ?? "default");
  // `loading` is a preview scenario, not a real fetch state: courses arrive
  // synchronously from the committed slice below. The timer resolves it back to
  // `default` so a previewed skeleton demonstrates itself and then leaves,
  // rather than sticking for the rest of the session.
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return {
    courses: initialCourses ?? courses,
    view,
  };
}
