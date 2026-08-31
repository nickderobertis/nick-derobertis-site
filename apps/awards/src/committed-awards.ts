import { awardsArtifact } from "@site/data-access-core/domains/awards";
import { validateCvDomain } from "@site/data-access-core/validators";

export const committedAwards = validateCvDomain("awards", awardsArtifact);
