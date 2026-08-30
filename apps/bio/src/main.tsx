// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

// Non-eager shares require an async import boundary before scope initialization.
const [{ default: Skeleton }] = await Promise.all([
  import("./skeleton"),
  import("@site/design-system"),
]);
const { parseRouteView, routeViewQueryKeys } = await import(
  "@site/route-state"
);

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
// The standalone boundary has no router, so this entry is where the view
// override is read; the shell's route validates the same parameter through
// validateSearch and hands the result to the same prop.
// llmlint: ignore[changed_behavior_has_e2e] bio.spec.ts already drives this entry's happy, empty, loading, and error states through the standalone remotes/ URL with ?bio-view=, alongside the host-composed path.
const initialView = parseRouteView(
  new URLSearchParams(window.location.search).get(routeViewQueryKeys.bio),
);
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialView={initialView} />
  </Suspense>,
);
