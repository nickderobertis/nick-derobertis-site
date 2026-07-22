import { type Course, cvDataClient } from "@site/data-access-core";
import {
  parseRouteView,
  type RouteView,
  routeStateQueryKeys,
} from "@site/route-state";

export function useCoursesPage(
  initialView?: RouteView,
  initialCourses?: Course[],
) {
  const requestedView =
    initialView ??
    (typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get(
          routeStateQueryKeys.courses,
        ));
  return {
    courses: initialCourses ?? cvDataClient.domain("courses"),
    view: parseRouteView(requestedView),
  };
}
