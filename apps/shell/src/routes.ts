import routeData from "./routes.json";
export interface SiteRoute {
  path: string;
  label: string;
  heading: string;
  description: string;
  remote?: string;
}
export const routes = routeData satisfies SiteRoute[];
