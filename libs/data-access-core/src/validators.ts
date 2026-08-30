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
import rootSchema from "../vendor/codegen/cv.schema.json" with { type: "json" };

export type * from "../vendor/codegen";

// `as const` because `CvDomain` below is this list's own members; widened to
// `string[]`, every domain lookup in this module would key on `string`.
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

interface CvRootSchemaContract {
  properties: Record<string, unknown>;
  required: string[];
}

export function deriveSchemaDomainNames(input: unknown): string[] {
  if (
    !input ||
    typeof input !== "object" ||
    !("properties" in input) ||
    !input.properties ||
    typeof input.properties !== "object" ||
    Array.isArray(input.properties) ||
    !("required" in input) ||
    !Array.isArray(input.required) ||
    !input.required.every((name) => typeof name === "string")
  )
    throw new Error(
      "cv.schema.json must define object properties and a string required list",
    );
  // Narrowed by the guard directly above, which TypeScript cannot carry across
  // an `in`-and-`typeof` chain onto one named shape.
  const schema = input as CvRootSchemaContract;
  return Object.keys(schema.properties).filter(
    (name) => !schema.required.includes(name),
  );
}

const schemaDomainNames = deriveSchemaDomainNames(rootSchema);
if (
  schemaDomainNames.length !== domainNames.length ||
  schemaDomainNames.some((name, index) => name !== domainNames[index])
)
  throw new Error(
    `CV domain contract drifted from cv.schema.json: expected ${schemaDomainNames.join(", ")}; received ${domainNames.join(", ")}`,
  );

/**
 * Ajv, built the first time something here actually validates.
 *
 * This module is what a browser loads to check a fetched CV domain, and a
 * container that fetches one domain has no use for the other five validators
 * or for the root's. Compiling them at module scope made every page pay for
 * all seven; building the engine and each validator on first use means a page
 * pays only for what it validates.
 *
 * `ajv/dist/standalone` was measured and not taken: it would add copies of
 * `cv.schema.json` here rather than remove the one `cvSchema` exports. The
 * measurement is in docs/cv-dataset-split-verification.md.
 */
let engine: Ajv | undefined;
function validatorEngine(): Ajv {
  if (engine) return engine;
  // `discriminator` is an OpenAPI annotation here; `oneOf` remains the validator.
  const ajv = new Ajv({ allErrors: true, strict: true, strictTypes: false });
  ajv.addKeyword({ keyword: "discriminator", schemaType: "object" });
  addFormats(ajv);
  engine = ajv;
  return ajv;
}

const domainValidators = new Map<CvDomain, ValidateFunction>();
function domainValidator<Name extends CvDomain>(
  name: Name,
): ValidateFunction<CvDomains[Name]> {
  const cached = domainValidators.get(name);
  // The map is keyed by domain name and written only below, so an entry under
  // `name` is that domain's validator; one map cannot hold six payload types.
  if (cached) return cached as ValidateFunction<CvDomains[Name]>;
  const compiled = validatorEngine().compile<CvDomains[Name]>({
    $defs: rootSchema.$defs,
    ...rootSchema.properties[name],
  });
  // Widened only to store it, for the same reason: the cache is one map over
  // six payload types, and the read above restores this domain's own.
  domainValidators.set(name, compiled as ValidateFunction);
  return compiled;
}

let rootValidator: ValidateFunction<CvData> | undefined;
function cvDataValidator(): ValidateFunction<CvData> {
  rootValidator ??= validatorEngine().compile<CvData>(rootSchema);
  return rootValidator;
}

export class CvDataValidationError extends Error {
  readonly issues: ErrorObject[];
  constructor(issues?: ErrorObject[] | null) {
    const normalizedIssues = issues ?? [];
    super(
      `CV data failed schema validation: ${validatorEngine().errorsText(normalizedIssues)}`,
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
        ? validatorEngine().errorsText(normalizedIssues)
        : "artifact differs from validated root data";
    super(`CV ${domain} domain failed ${reason} validation: ${detail}`);
    this.name = "CvDomainValidationError";
    this.domain = domain;
    this.issues = normalizedIssues;
    this.reason = reason;
  }
}

export function validateCvData(input: unknown): CvData {
  const validate = cvDataValidator();
  if (!validate(input)) throw new CvDataValidationError(validate.errors);
  return input;
}

export function validateCvDomain<Name extends CvDomain>(
  name: Name,
  input: unknown,
): CvDomains[Name] {
  const validator = domainValidator(name);
  if (!validator(input))
    throw new CvDomainValidationError(name, "schema", validator.errors);
  return input;
}

export const cvSchema: unknown = rootSchema;
