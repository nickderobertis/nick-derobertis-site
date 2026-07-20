import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type {
  Awards,
  Courses,
  CvData,
  Research,
  Skills,
  SoftwareProjects,
  Timeline,
} from "../vendor/codegen";
import rootData from "../vendor/codegen/cv.json";
import rootSchema from "../vendor/codegen/cv.schema.json";
import awards from "../vendor/codegen/domains/awards.json";
import courses from "../vendor/codegen/domains/courses.json";
import research from "../vendor/codegen/domains/research.json";
import skills from "../vendor/codegen/domains/skills.json";
import softwareProjects from "../vendor/codegen/domains/software_projects.json";
import timeline from "../vendor/codegen/domains/timeline.json";

export const domainNames = [
  "awards",
  "courses",
  "research",
  "skills",
  "software_projects",
  "timeline",
] as const;
export type CvDomain = (typeof domainNames)[number];
export interface CvDomains {
  awards: Awards;
  courses: Courses;
  research: Research;
  skills: Skills;
  software_projects: SoftwareProjects;
  timeline: Timeline;
}
export type CvDomainArtifacts = Record<CvDomain, unknown>;

// `discriminator` is an OpenAPI annotation here; `oneOf` remains the validator.
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictTypes: false,
});
ajv.addKeyword({ keyword: "discriminator", schemaType: "object" });
addFormats(ajv);
const validate = ajv.compile<CvData>(rootSchema);
const domainValidators: {
  [Name in CvDomain]: ValidateFunction<CvDomains[Name]>;
} = {
  awards: ajv.compile<Awards>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.awards,
  }),
  courses: ajv.compile<Courses>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.courses,
  }),
  research: ajv.compile<Research>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.research,
  }),
  skills: ajv.compile<Skills>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.skills,
  }),
  software_projects: ajv.compile<SoftwareProjects>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.software_projects,
  }),
  timeline: ajv.compile<Timeline>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties.timeline,
  }),
};

export class CvDataValidationError extends Error {
  readonly issues: ErrorObject[];
  constructor(issues?: ErrorObject[] | null) {
    const normalizedIssues = issues ?? [];
    super(
      `CV data failed schema validation: ${ajv.errorsText(normalizedIssues)}`,
    );
    this.name = "CvDataValidationError";
    this.issues = normalizedIssues;
  }
}

export class CvDomainValidationError extends Error {
  readonly domain: CvDomain;
  readonly issues: ErrorObject[];
  readonly reason: "schema" | "drift";

  constructor(
    domain: CvDomain,
    reason: "schema" | "drift",
    issues?: ErrorObject[] | null,
  ) {
    const normalizedIssues = issues ?? [];
    const detail =
      reason === "schema"
        ? ajv.errorsText(normalizedIssues)
        : "artifact differs from validated root data";
    super(`CV ${domain} domain failed ${reason} validation: ${detail}`);
    this.name = "CvDomainValidationError";
    this.domain = domain;
    this.issues = normalizedIssues;
    this.reason = reason;
  }
}

export function validateCvData(input: unknown): CvData {
  if (!validate(input)) throw new CvDataValidationError(validate.errors);
  return input;
}

export const cvSchema: unknown = rootSchema;

export interface CvDataClient {
  domain<Name extends CvDomain>(name: Name): CvDomains[Name];
  root(): CvData;
  schema(): unknown;
}

function validateDomain<Name extends CvDomain>(
  name: Name,
  input: unknown,
  expected: CvDomains[Name] | undefined,
  validator: ValidateFunction<CvDomains[Name]>,
): CvDomains[Name] {
  if (!validator(input))
    throw new CvDomainValidationError(name, "schema", validator.errors);
  if (
    expected === undefined ||
    JSON.stringify(input) !== JSON.stringify(expected)
  )
    throw new CvDomainValidationError(name, "drift");
  return input;
}

export function validateCvDomain<Name extends CvDomain>(
  name: Name,
  input: unknown,
): CvDomains[Name] {
  const validator = domainValidators[name] as ValidateFunction<CvDomains[Name]>;
  if (!validator(input))
    throw new CvDomainValidationError(name, "schema", validator.errors);
  return input;
}

export function createCvDataClient(
  rootInput: unknown,
  artifacts: CvDomainArtifacts,
): CvDataClient {
  const root = validateCvData(rootInput);
  const domains: CvDomains = {
    awards: validateDomain(
      "awards",
      artifacts.awards,
      root.awards,
      domainValidators.awards,
    ),
    courses: validateDomain(
      "courses",
      artifacts.courses,
      root.courses,
      domainValidators.courses,
    ),
    research: validateDomain(
      "research",
      artifacts.research,
      root.research,
      domainValidators.research,
    ),
    skills: validateDomain(
      "skills",
      artifacts.skills,
      root.skills,
      domainValidators.skills,
    ),
    software_projects: validateDomain(
      "software_projects",
      artifacts.software_projects,
      root.software_projects,
      domainValidators.software_projects,
    ),
    timeline: validateDomain(
      "timeline",
      artifacts.timeline,
      root.timeline,
      domainValidators.timeline,
    ),
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
};
export const cvDataClient = createCvDataClient(rootData, importedArtifacts);
export const cvData = cvDataClient.root();
export const cvDomains: CvDomains = {
  awards: cvDataClient.domain("awards"),
  courses: cvDataClient.domain("courses"),
  research: cvDataClient.domain("research"),
  skills: cvDataClient.domain("skills"),
  software_projects: cvDataClient.domain("software_projects"),
  timeline: cvDataClient.domain("timeline"),
};
