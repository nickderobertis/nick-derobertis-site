import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "bio",
  standalone: "remotes/bio/",
  role: "heading",
  name: "Optimizing Life",
  loadingName: "Loading biography",
  loadingQuery: "bio-view=loading",
});
