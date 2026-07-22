import { RouterProvider } from "@tanstack/react-router";
import type { SiteRouter } from "./router";

export function App({ router }: { router: SiteRouter }) {
  return <RouterProvider router={router} />;
}
