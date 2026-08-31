// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

// Non-eager shares require an async import boundary before scope initialization.
// llmlint: ignore[changed_behavior_has_e2e] This Biography entry defers its shared design-system and route-state imports until share-scope startup completes. The composed and standalone journeys live in apps/shell/e2e/shared-scope.spec.ts, with JavaScript-disabled standalone pane coverage in apps/shell/e2e/site.spec.ts for every Home pane; this does not change route empty, loading, or data-error states.
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
const initialView = parseRouteView(
  new URLSearchParams(window.location.search).get(routeViewQueryKeys.bio),
);
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page initialView={initialView} />
  </Suspense>,
);
