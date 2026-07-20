import { describe, expect, it } from "vitest";
import {
  CvDataValidationError,
  type CvDomainArtifacts,
  CvDomainValidationError,
  createCvDataClient,
  cvDataClient,
  cvDomains,
  domainNames,
  loadAwards,
  selectAwards,
  validateAwards,
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

  it("owns and validates the selected awards subset", () => {
    const awards = cvDataClient.domain("awards");
    expect(selectAwards(awards).map((award) => award.id)).toEqual([
      "warrington-college-of-business-ph-d-student-teaching-award",
      "graduate-management-admission-test-gmat-score",
      "cfa-global-investment-research-challenge-global-semi-finalist",
      "finance-student-of-the-year",
    ]);
    expect(validateAwards([])).toEqual([]);
    expect(() => validateAwards([{ id: 42 }])).toThrow(CvDomainValidationError);
  });

  it("loads awards through the validated HTTP boundary", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/awards.json") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(cvDataClient.domain("awards")));
        return;
      }
      response.writeHead(503).end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a TCP test server address");
    const origin = `http://127.0.0.1:${address.port}`;
    await expect(loadAwards(`${origin}/awards.json`)).resolves.toHaveLength(7);
    await expect(loadAwards(`${origin}/unavailable`)).rejects.toThrow(
      "status 503",
    );
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
});

import { createServer } from "node:http";
