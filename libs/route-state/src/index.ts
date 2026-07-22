export type AsyncViewState<T> =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; value: T };

export const routeViews = ["default", "empty", "error", "loading"] as const;
export type RouteView = (typeof routeViews)[number];

export function parseRouteView(value: string | null | undefined): RouteView {
  return routeViews.find((view) => view === value) ?? "default";
}
