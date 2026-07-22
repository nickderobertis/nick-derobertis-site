import { z } from "zod";

export type AsyncViewState<T> =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; value: T };

export const routeViews = ["default", "empty", "error", "loading"] as const;
export type RouteView = (typeof routeViews)[number];

export function parseRouteView(value: string | null | undefined): RouteView {
  return routeViews.find((view) => view === value) ?? "default";
}

export interface BioPageProps {
  initialView?: RouteView;
}
export interface ResearchPageProps<T> {
  initialState?: AsyncViewState<T>;
}
export interface SoftwarePageProps<T> {
  initialView?: RouteView;
  projects?: T;
}
export interface CoursesPageProps<T> {
  initialView?: RouteView;
  courses?: T;
}

const siteRouteSchema = z.object({
  path: z.string().regex(/^\/(?:[a-z0-9-]+)?$/),
  label: z.string().min(1),
  heading: z.string().min(1),
  description: z.string().min(1),
  remote: z.string().min(1).optional(),
});
export type SiteRoute = z.infer<typeof siteRouteSchema>;

export function parseSiteRoutes(value: unknown): SiteRoute[] {
  return z.array(siteRouteSchema).min(1).parse(value);
}
