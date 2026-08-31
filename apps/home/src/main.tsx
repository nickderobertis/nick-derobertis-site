// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

// Non-eager shares require an async import boundary before scope initialization.
// llmlint: ignore[changed_behavior_has_e2e] This Home container now crosses an async boundary before resolving non-eager shared modules. Its composed and standalone startup proof is in apps/shell/e2e/shared-scope.spec.ts, and apps/shell/e2e/site.spec.ts covers the JavaScript-disabled standalone pane journey across every Home pane; no route empty, loading, or data-error state changed.
const [{ default: Skeleton }] = await Promise.all([
  import("./skeleton"),
  import("@site/design-system"),
]);

const Page = lazy(() => import("./page"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
createRoot(root).render(
  <Suspense fallback={<Skeleton />}>
    <Page />
  </Suspense>,
);
