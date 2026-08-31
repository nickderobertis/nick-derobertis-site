// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./awards.css";

// Non-eager shares require an async import boundary before scope initialization.
// llmlint: ignore[changed_behavior_has_e2e] This Awards entry now initializes non-eager shared libraries behind its async startup boundary. apps/shell/e2e/shared-scope.spec.ts proves composed and standalone startup, while apps/shell/e2e/site.spec.ts proves the JavaScript-disabled standalone pane path across Home's panes; route empty, loading, and data-error behavior is unchanged by this startup-only work.
const [{ default: Skeleton }] = await Promise.all([
  import("./skeleton"),
  import("@site/design-system"),
]);

const pageModule = import("./page");
const Page = lazy(() => pageModule);

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
const canHydrate = root.hasChildNodes() && !window.location.search;
if (canHydrate) {
  const { default: HydratedPage } = await pageModule;
  hydrateRoot(root, <HydratedPage />);
} else {
  root.replaceChildren();
  createRoot(root).render(
    <Suspense fallback={<Skeleton />}>
      <Page />
    </Suspense>,
  );
}
