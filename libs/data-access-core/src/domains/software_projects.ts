import artifact from "../../vendor/codegen/domains/software_projects.json" with {
  type: "json",
};

/**
 * The committed software_projects domain file, and nothing else.
 *
 * One module per domain, each published on its own subpath, is what lets a
 * feature reach its own slice without reaching any other: a module that
 * imports this one pulls in software_projects.json alone, where
 * `@site/data-access-core/bundled` pulls in the aggregate and all six domains.
 *
 * The value is `unknown` because nothing here has checked it. The
 * `data-access-software` library is what validates it, through
 * `validateCvDomain`, before exporting the slice a feature reads.
 */
export const softwareProjectsArtifact: unknown = artifact;
