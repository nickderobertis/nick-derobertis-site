import { cvDataClient } from "@site/data-access";
import { lazy, Suspense } from "react";

const SoftwarePage = lazy(() => import("software/Page"));
export default function ResearchPage() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>Research</h1>
      <p>Working papers and research in finance.</p>
      <output className="placeholder">
        Research remote loaded ·{" "}
        {cvDataClient.domain("research").projects?.length ?? 0} projects
      </output>
      <details>
        <summary>Related software federation</summary>
        <Suspense fallback={<span>Loading related software…</span>}>
          <SoftwarePage />
        </Suspense>
      </details>
    </section>
  );
}
