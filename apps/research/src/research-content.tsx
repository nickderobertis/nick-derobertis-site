import type { Research } from "@site/data-access-core";
import { buildResearchProjectModels } from "@site/data-access-research";
import { ActionLink, PageShell, SectionHeading } from "@site/design-system";
import { ProjectSection } from "./project-section";

export function ResearchContent({ research }: { research: Research }) {
  return (
    <PageShell as="article" className="research-page">
      <SectionHeading
        className="research-banner"
        level={1}
        eyebrow="Research portfolio"
        title="Research Works"
        description="Working papers and works in progress across finance, markets, and investor behavior."
      >
        <ActionLink className="banner-link" href="#working-papers">
          View research
        </ActionLink>
      </SectionHeading>
      <ProjectSection
        heading="Working Papers"
        id="working-papers"
        projects={buildResearchProjectModels(research, "working_paper")}
      />
      <ProjectSection
        heading="Works in Progress"
        id="works-in-progress"
        projects={buildResearchProjectModels(research, "work_in_progress")}
      />
    </PageShell>
  );
}
