import "@site/design-system";
import { parseRouteView, routeViewQueryKeys } from "@site/route-state";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Skeleton from "./skeleton";

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop.
// llmlint: ignore[changed_behavior_has_e2e] software.spec.ts already drives this entry's happy, empty, loading, and error states through the standalone remotes/ URL with ?software-view=, alongside the host-composed path.
const initialView = parseRouteView(
  new URLSearchParams(window.location.search).get(routeViewQueryKeys.software),
);
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialView={initialView} />
  </Suspense>,
);
