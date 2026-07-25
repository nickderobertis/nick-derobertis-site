import { parseSiteRoutes, type SiteRoute } from "@site/route-state";
import routeData from "./routes.json";

export type { SiteRoute };
export const routes = parseSiteRoutes(routeData);
