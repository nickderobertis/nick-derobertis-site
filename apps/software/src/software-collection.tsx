import type { SoftwareProject } from "@site/data-access-core";
import { calculateSoftwareStats } from "@site/data-access-software";
import { formatNumber } from "./format-number";
import { ProjectCard } from "./project-card";

export function SoftwareCollection({
  projects,
}: {
  projects: SoftwareProject[];
}) {
  const stats = calculateSoftwareStats(projects);
  return (
    <>
      <dl className="software-stats" aria-label="Software statistics">
        <div>
          <dt>Open-source projects</dt>
          <dd>{formatNumber(stats.projects)}</dd>
        </div>
        <div>
          <dt>Lines of code</dt>
          <dd>{formatNumber(stats.linesOfCode)}</dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>{formatNumber(stats.commits)}</dd>
        </div>
      </dl>
      <section className="software-grid" aria-label="Software projects">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </>
  );
}
