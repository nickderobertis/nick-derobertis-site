// eslint-disable-next-line @nx/enforce-module-boundaries -- CSS must remain an initial asset while the shared design-system JavaScript initializes asynchronously.
import "@site/design-system/styles.css";
import { lazy, Suspense } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./carousel.css";

// Non-eager shares require an async import boundary before scope initialization.
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
