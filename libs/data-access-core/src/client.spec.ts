import { describe, expect, it } from "vitest";
import rootSchema from "../vendor/codegen/cv.schema.json";
import {
  CvDataValidationError,
  type CvDomainArtifacts,
  CvDomainValidationError,
  createCvDataClient,
  cvDataClient,
  cvDomains,
  domainNames,
  validateCvData,
  validateCvDomain,
} from "./client";

describe("vendored CV data boundary", () => {
  it("loads the committed root, schema, and six real domains", () => {
    const schemaDomainNames = Object.keys(rootSchema.properties).filter(
      (name) => !rootSchema.required.includes(name),
    );
    expect(domainNames).toEqual(schemaDomainNames);
    expect(cvDataClient.root().schema_version).toBe(3);
    expect(cvDataClient.schema()).toMatchObject({ type: "object" });
    expect(cvDataClient.domain("awards")).toHaveLength(7);
    expect(cvDataClient.domain("courses")).toHaveLength(3);
    expect(cvDataClient.domain("research").projects?.length).toBeGreaterThan(0);
    expect(cvDataClient.domain("skills")).toHaveLength(200);
    expect(cvDataClient.domain("software_projects")).toHaveLength(72);
    expect(cvDataClient.domain("timeline")).toHaveLength(14);
  });

  it("surfaces schema failures with actionable issues", () => {
    expect(() => validateCvData({ schema_version: "wrong" })).toThrow(
      CvDataValidationError,
    );
    try {
      validateCvData({ schema_version: "wrong" });
    } catch (error) {
      expect(error).toBeInstanceOf(CvDataValidationError);
      expect((error as CvDataValidationError).issues.length).toBeGreaterThan(0);
    }
    expect(new CvDataValidationError().issues).toEqual([]);
  });

  it("rejects a malformed imported domain through the client boundary", () => {
    const artifacts: CvDomainArtifacts = structuredClone(cvDomains);
    artifacts.awards = [{ id: 42 }];

    expect(() => createCvDataClient(cvDataClient.root(), artifacts)).toThrow(
      CvDomainValidationError,
    );
    try {
      createCvDataClient(cvDataClient.root(), artifacts);
    } catch (error) {
      if (!(error instanceof CvDomainValidationError)) throw error;
      expect(error.domain).toBe("awards");
      expect(error.reason).toBe("schema");
      expect(error.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects a valid domain artifact that drifts from the root", () => {
    const artifacts: CvDomainArtifacts = structuredClone(cvDomains);
    artifacts.awards = cvDomains.awards.slice(1);

    expect(() => createCvDataClient(cvDataClient.root(), artifacts)).toThrow(
      "artifact differs from validated root data",
    );
    try {
      createCvDataClient(cvDataClient.root(), artifacts);
    } catch (error) {
      if (!(error instanceof CvDomainValidationError)) throw error;
      expect(error.domain).toBe("awards");
      expect(error.reason).toBe("drift");
      expect(error.issues).toEqual([]);
    }
  });

  it("validates independently loaded domain responses", () => {
    expect(validateCvDomain("research", { projects: [] })).toEqual({
      projects: [],
    });
    expect(() =>
      validateCvDomain("research", { projects: [{ id: 42 }] }),
    ).toThrow(CvDomainValidationError);
  });
});
