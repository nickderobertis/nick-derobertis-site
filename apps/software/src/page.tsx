import type { SoftwareProject } from "@site/data-access-core";
import { PageShell, SectionHeading } from "@site/design-system";
import type { SoftwarePageProps } from "@site/route-state";
import "./software.css";
import Skeleton from "./skeleton";
import { SoftwareCollection } from "./software-collection";
import { useSoftwarePage } from "./use-software-page";

export default function SoftwarePage({
  initialView,
  projects: initialProjects,
}: SoftwarePageProps<SoftwareProject[]>) {
  const { projects, view } = useSoftwarePage(initialView, initialProjects);
  return (
    // llmlint: ignore[changed_behavior_has_e2e] software/e2e/software.spec.ts drives this page's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitives' painted contract is additionally covered by the home-cards and home-story dual-path journeys, so duplicating CSS assertions here would not exercise a distinct boundary.
    <PageShell className="software-page">
      <SectionHeading
        className="software-banner"
        level={1}
        eyebrow="Nick DeRobertis"
        title="Open-Source Software"
        description="I am a strong believer in free and open-source software. Explore my projects for finance, research, data, and Python."
      />
      {view === "loading" ? (
        <Skeleton />
      ) : view === "error" ? (
        <div className="software-state software-state-error" role="alert">
          <h2>Software projects are unavailable</h2>
          <p>Please try again later.</p>
        </div>
      ) : view === "empty" ? (
        <div className="software-state" role="status">
          <h2>No software projects to show</h2>
          <p>New open-source work will appear here.</p>
        </div>
      ) : (
        <SoftwareCollection projects={projects} />
      )}
    </PageShell>
  );
}
