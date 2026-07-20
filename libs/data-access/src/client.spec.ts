import { describe, expect, it } from "vitest";
import {
  CvDataValidationError,
  cvDataClient,
  domainNames,
  validateCvData,
} from "./client";

describe("vendored CV data boundary", () => {
  it("loads the committed root, schema, and six real domains", () => {
    expect(domainNames).toEqual([
      "awards",
      "courses",
      "research",
      "skills",
      "software_projects",
      "timeline",
    ]);
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
});
