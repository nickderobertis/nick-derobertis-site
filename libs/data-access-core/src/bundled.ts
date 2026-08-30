import type { CvData } from "../vendor/codegen";
import rootData from "../vendor/codegen/cv.json" with { type: "json" };
import awards from "../vendor/codegen/domains/awards.json" with {
  type: "json",
};
import courses from "../vendor/codegen/domains/courses.json" with {
  type: "json",
};
import research from "../vendor/codegen/domains/research.json" with {
  type: "json",
};
import skills from "../vendor/codegen/domains/skills.json" with {
  type: "json",
};
import softwareProjects from "../vendor/codegen/domains/software_projects.json" with {
  type: "json",
};
import timeline from "../vendor/codegen/domains/timeline.json" with {
  type: "json",
};
import {
  type CvDomain,
  type CvDomainArtifacts,
  type CvDomains,
  CvDomainValidationError,
  cvSchema,
  validateCvData,
  validateCvDomain,
} from "./validators";

export interface CvDataClient {
  domain<Name extends CvDomain>(name: Name): CvDomains[Name];
  root(): CvData;
  schema(): unknown;
}

function validateDomain<Name extends CvDomain>(
  name: Name,
  input: unknown,
  expected: CvDomains[Name] | undefined,
): CvDomains[Name] {
  const validated = validateCvDomain(name, input);
  if (
    expected === undefined ||
    JSON.stringify(validated) !== JSON.stringify(expected)
  )
    throw new CvDomainValidationError(name, "drift");
  return validated;
}

/**
 * Checks the six committed domain files against the schema and against the
 * aggregate they are cut from, and reads them back through one client.
 *
 * This is the CV's integrity check, and `bundled.spec.ts` is where it runs:
 * once per `nx run data-access-core:test`, over exactly the files below.
 * Running it at module scope instead made every browser that imported this
 * library compile seven validators and serialise the whole dataset twice on
 * load, for an answer that cannot differ between two loads of the same commit.
 */
export function createCvDataClient(
  rootInput: unknown,
  artifacts: CvDomainArtifacts,
): CvDataClient {
  const root = validateCvData(rootInput);
  const domains: CvDomains = {
    awards: validateDomain("awards", artifacts.awards, root.awards),
    courses: validateDomain("courses", artifacts.courses, root.courses),
    research: validateDomain("research", artifacts.research, root.research),
    skills: validateDomain("skills", artifacts.skills, root.skills),
    software_projects: validateDomain(
      "software_projects",
      artifacts.software_projects,
      root.software_projects,
    ),
    timeline: validateDomain("timeline", artifacts.timeline, root.timeline),
  };
  return {
    domain: (name) => domains[name],
    root: () => root,
    schema: () => cvSchema,
  };
}

const importedArtifacts = {
  awards,
  courses,
  research,
  skills,
  software_projects: softwareProjects,
  timeline,
} satisfies CvDomainArtifacts;

/**
 * The committed files under their own generated types. TypeScript infers a
 * JSON import's literal shape, which widens every discriminant the CV declares
 * — `kind`, `display_case`, `status` — to `string`, so the generated types are
 * out of inference's reach from here. `createCvDataClient` above is what
 * proves these assertions, and `bundled.spec.ts` runs it over exactly these
 * files on every `nx run data-access-core:test`.
 */
export const cvData = rootData as unknown as CvData;
export const cvDomains = importedArtifacts as unknown as CvDomains;

/**
 * The committed CV, read as the files commit it. Nothing is validated here:
 * `createCvDataClient` above is that check, and the spec beside this module is
 * what runs it over these same files.
 */
export const cvDataClient: CvDataClient = {
  domain: (name) => cvDomains[name],
  root: () => cvData,
  schema: () => cvSchema,
};
