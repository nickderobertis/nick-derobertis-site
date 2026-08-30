import { describe, expect, it, vi } from "vitest";
import rootSchema from "../vendor/codegen/cv.schema.json" with { type: "json" };
import {
  CvDataValidationError,
  CvDomainValidationError,
  cvSchema,
  deriveSchemaDomainNames,
  domainNames,
  validateCvData,
  validateCvDomain,
} from "./validators";

describe("CV validators", () => {
  it("names the domains the committed schema leaves optional", () => {
    expect(domainNames).toEqual(
      Object.keys(rootSchema.properties).filter(
        (name) => !rootSchema.required.includes(name),
      ),
    );
    expect(cvSchema).toMatchObject({ type: "object" });
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

  it("rejects a malformed schema before reading its domain contract", () => {
    expect(() => deriveSchemaDomainNames({ properties: [] })).toThrow(
      "cv.schema.json must define object properties and a string required list",
    );
    expect(() =>
      deriveSchemaDomainNames({ properties: {}, required: [42] }),
    ).toThrow(
      "cv.schema.json must define object properties and a string required list",
    );
  });

  it("validates independently loaded domain responses", () => {
    expect(validateCvDomain("research", { projects: [] })).toEqual({
      projects: [],
    });
    // The second call reads the validator the first one compiled, which is
    // what a page that fetches its domain twice must not pay for twice.
    expect(validateCvDomain("research", { projects: [] })).toEqual({
      projects: [],
    });
    expect(() =>
      validateCvDomain("research", { projects: [{ id: 42 }] }),
    ).toThrow(CvDomainValidationError);
  });

  it("reports which domain refused a response and why", () => {
    try {
      validateCvDomain("awards", [{ id: 42 }]);
      expect.unreachable("awards accepted a payload the schema refuses");
    } catch (error) {
      if (!(error instanceof CvDomainValidationError)) throw error;
      expect(error.domain).toBe("awards");
      expect(error.reason).toBe("schema");
      expect(error.issues.length).toBeGreaterThan(0);
    }
  });

  it("compiles no validator until something asks it to validate", async () => {
    // Compiling seven validators at module scope is what this module stopped
    // doing, so the property is that importing it compiles none and that a
    // page pays once for each domain it actually validates.
    vi.resetModules();
    const { default: Ajv } = await import("ajv");
    const compile = vi.spyOn(Ajv.prototype, "compile");
    const validators = await import("./validators");

    expect(compile).not.toHaveBeenCalled();

    validators.validateCvDomain("timeline", []);
    validators.validateCvDomain("timeline", []);
    expect(compile).toHaveBeenCalledTimes(1);

    validators.validateCvDomain("skills", []);
    expect(compile).toHaveBeenCalledTimes(2);

    expect(() => validators.validateCvData({})).toThrow(
      validators.CvDataValidationError,
    );
    expect(compile).toHaveBeenCalledTimes(3);
    compile.mockRestore();
  });
});
