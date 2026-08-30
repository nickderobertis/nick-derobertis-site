import { timelineArtifact } from "@site/data-access-core/domains/timeline";
import { validateCvDomain } from "@site/data-access-core/validators";

/**
 * The committed timeline domain, validated against the CV schema as this
 * module loads and exported as the only shape a feature reads it in.
 *
 * The import above reaches timeline.json and nothing else, so a feature that
 * reads this slice carries this domain's bytes rather than the whole CV. The
 * validation runs here rather than in each consumer because there is one
 * committed file and one answer about it: a slice the schema rejects fails the
 * import, so no consumer can render from data nothing checked.
 */
export const timeline = validateCvDomain("timeline", timelineArtifact);
