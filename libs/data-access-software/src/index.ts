import type { SoftwareProject } from "@site/data-access-core";

export interface SoftwareStats {
  commits: number;
  linesOfCode: number;
  projects: number;
}

export function softwareProjectLogo(project: SoftwareProject) {
  return project.logo_base64 ?? project.logo_url ?? undefined;
}

export function calculateSoftwareStats(
  projects: readonly SoftwareProject[],
): SoftwareStats {
  return {
    commits: projects.reduce(
      (total, project) => total + (project.commits ?? 0),
      0,
    ),
    linesOfCode: projects.reduce(
      (total, project) => total + (project.loc ?? 0),
      0,
    ),
    projects: projects.length,
  };
}
