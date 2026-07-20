import Ajv, { type ErrorObject } from "ajv";
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

// `discriminator` is an OpenAPI annotation here; `oneOf` remains the validator.
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictTypes: false,
});
ajv.addKeyword({ keyword: "discriminator", schemaType: "object" });
addFormats(ajv);
const validate = ajv.compile<CvData>(rootSchema);

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

export function validateCvData(input: unknown): CvData {
  if (!validate(input)) throw new CvDataValidationError(validate.errors);
  return input;
}

export const cvData = validateCvData(rootData);
export const cvSchema: unknown = rootSchema;
export const cvDomains: CvDomains = {
  awards: awards as Awards,
  courses: courses as Courses,
  research: research as Research,
  skills: skills as unknown as Skills,
  software_projects: softwareProjects as SoftwareProjects,
  timeline: timeline as Timeline,
};

export interface CvDataClient {
  domain<Name extends CvDomain>(name: Name): CvDomains[Name];
  root(): CvData;
  schema(): unknown;
}
export const cvDataClient: CvDataClient = {
  domain: (name) => cvDomains[name],
  root: () => cvData,
  schema: () => cvSchema,
};
