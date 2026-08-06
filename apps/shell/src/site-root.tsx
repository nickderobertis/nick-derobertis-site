import { SiteLayout } from "@site/layout";
import { Outlet } from "@tanstack/react-router";
import { routes } from "./routes";

/**
 * The chrome every route renders inside. The header, its primary navigation,
 * and the footer are mounted once by the root route, so a route change swaps
 * only the outlet beneath them and the navigation a visitor is using never
 * unmounts underneath them.
 */
export function SiteRoot() {
  return (
    <SiteLayout routes={routes.map(({ path, label }) => ({ path, label }))}>
      <Outlet />
    </SiteLayout>
  );
}
