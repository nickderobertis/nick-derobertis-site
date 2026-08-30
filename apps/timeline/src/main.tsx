// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

// A share cannot be reached from an entry's own chunk: Module Federation
// resolves an initial consume synchronously, before this container has a share
// scope to resolve it in, and refuses. Importing it dynamically is the boundary
// that puts the consume in a chunk the runtime can await instead, which is what
// lets the modules below be singletons one page evaluates once rather than once
// per container.
//
// The extracted skeleton primitive consumes the same non-eager share, so load
// the local skeleton through this async boundary as the theme initializes.
const [{ default: Skeleton }] = await Promise.all([
  import("./skeleton"),
  import("@site/design-system"),
]);

const pageModule = import("./page");
const TimelinePage = lazy(() => pageModule);

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
      <TimelinePage />
    </Suspense>,
  );
}
