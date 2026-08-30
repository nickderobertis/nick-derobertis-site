import type { CvData } from "../vendor/codegen";
import rootData from "../vendor/codegen/cv.json" with { type: "json" };
import { awardsArtifact } from "./domains/awards";
import { coursesArtifact } from "./domains/courses";
import { researchArtifact } from "./domains/research";
import { skillsArtifact } from "./domains/skills";
import { softwareProjectsArtifact } from "./domains/software_projects";
import { timelineArtifact } from "./domains/timeline";
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
 * once per run of this project's `test` target, over exactly the files below.
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
  awards: awardsArtifact,
  courses: coursesArtifact,
  research: researchArtifact,
  skills: skillsArtifact,
  software_projects: softwareProjectsArtifact,
  timeline: timelineArtifact,
} satisfies CvDomainArtifacts;

/**
 * The committed files under their own generated types. TypeScript infers a
 * JSON import's literal shape, which widens every discriminant the CV declares
 * — `kind`, `display_case`, `status` — to `string`, so the generated types are
 * out of inference's reach from here. `createCvDataClient` above is what
 * proves these assertions, and `bundled.spec.ts` runs it over exactly these
 * files on every run of this project's `test` target.
 */
// llmlint: ignore-block[boundary_inputs_validated] Committed files the bundler inlines at build time, not runtime input; `bundled.spec.ts` validates these exact exports.
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
// llmlint: ignore-end[boundary_inputs_validated]
