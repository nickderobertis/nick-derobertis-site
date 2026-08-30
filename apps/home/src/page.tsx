import { siteBase } from "@site/data-access-core/site";
import { homeContent } from "@site/data-access-home";
import { PageShell } from "@site/design-system";
import { Suspense, useState } from "react";
import { homePanes, resolvedPanes } from "./panes";
import "./home.css";

// Hosts reach this through the remote's existing ./Page expose, so warming the
// composed page costs no new federation surface.
export { preload } from "./panes";

// Keep the Home host in both shared data dependency graphs; panes own rendering.
void siteBase;
void homeContent;

export default function HomePage() {
  // Settle the render path once per mount: a preload that lands mid-life must
  // not swap pane component identity and remount every pane underneath.
  const [panes] = useState(resolvedPanes);
  if (panes)
    return (
      <PageShell as="div" className="home-main">
        {panes.map(({ name, Page }) => (
          <Page key={name} />
        ))}
      </PageShell>
    );
  return (
    <PageShell as="div" className="home-main">
      {homePanes.map(({ name, Skeleton, Page }) => (
        <Suspense key={name} fallback={<Skeleton />}>
          <Page />
        </Suspense>
      ))}
    </PageShell>
  );
}
