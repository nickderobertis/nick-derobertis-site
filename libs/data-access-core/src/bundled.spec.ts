import { describe, expect, it } from "vitest";
import type { CvData } from "../vendor/codegen";
import {
  type CvDataClient,
  createCvDataClient,
  cvData,
  cvDataClient,
  cvDomains,
} from "./bundled";
import {
  type CvDomainArtifacts,
  CvDomainValidationError,
  domainNames,
} from "./validators";

/**
 * The committed aggregate and the committed domain files, checked against the
 * schema and against each other. This is the integrity check the browser used
 * to run on every load; running it here is what keeps it a check.
 */
function checkCommittedData(): CvDataClient {
  return createCvDataClient(cvData, cvDomains);
}

describe("bundled CV data", () => {
  it("loads the committed root and six real domains", () => {
    expect(cvDataClient.root().schema_version).toBe(3);
    expect(cvDataClient.schema()).toMatchObject({ type: "object" });
    expect(cvDataClient.domain("awards")).toHaveLength(7);
    expect(cvDataClient.domain("courses")).toHaveLength(3);
    expect(cvDataClient.domain("research").projects?.length).toBeGreaterThan(0);
    expect(cvDataClient.domain("skills")).toHaveLength(200);
    expect(cvDataClient.domain("software_projects")).toHaveLength(72);
    expect(cvDataClient.domain("timeline")).toHaveLength(14);
  });

  it("accepts every committed domain file against the schema and the aggregate", () => {
    const checked = checkCommittedData();

    for (const name of domainNames)
      expect(checked.domain(name)).toEqual(cvDataClient.domain(name));
    expect(checked.root()).toEqual(cvDataClient.root());
    expect(checked.schema()).toBe(cvDataClient.schema());
  });

  it.each(domainNames)(
    "refuses the committed data when %s disagrees with the aggregate",
    (name) => {
      const artifacts: CvDomainArtifacts = structuredClone(cvDomains);
      const drifted = artifacts[name];
      // `CvDomainArtifacts` values are `unknown` by design, so spreading the
      // one non-list domain needs the assertion the `isArray` branch does not.
      artifacts[name] = Array.isArray(drifted)
        ? drifted.slice(1)
        : { ...(drifted as object), projects: [] };

      expect(() => createCvDataClient(cvData, artifacts)).toThrow(
        "artifact differs from validated root data",
      );
      try {
        createCvDataClient(cvData, artifacts);
        expect.unreachable(`${name} drift was accepted`);
      } catch (error) {
        if (!(error instanceof CvDomainValidationError)) throw error;
        expect(error.domain).toBe(name);
        expect(error.reason).toBe("drift");
        expect(error.issues).toEqual([]);
      }
    },
  );

  it("rejects a malformed domain artifact before comparing it to the aggregate", () => {
    const artifacts: CvDomainArtifacts = structuredClone(cvDomains);
    artifacts.awards = [{ id: 42 }];

    expect(() => createCvDataClient(cvData, artifacts)).toThrow(
      CvDomainValidationError,
    );
    try {
      createCvDataClient(cvData, artifacts);
      expect.unreachable("a malformed awards artifact was accepted");
    } catch (error) {
      if (!(error instanceof CvDomainValidationError)) throw error;
      expect(error.domain).toBe("awards");
      expect(error.reason).toBe("schema");
      expect(error.issues.length).toBeGreaterThan(0);
    }
  });

  it("refuses an aggregate that does not satisfy the schema", () => {
    expect(() =>
      createCvDataClient({ schema_version: "wrong" }, cvDomains),
    ).toThrow("CV data failed schema validation");
  });

  it("refuses a domain the aggregate does not carry at all", () => {
    const rootWithoutAwards: Partial<CvData> = structuredClone(cvData);
    delete rootWithoutAwards.awards;

    expect(() => createCvDataClient(rootWithoutAwards, cvDomains)).toThrow(
      "artifact differs from validated root data",
    );
  });
});
