import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "software",
  standalone: "remotes/software/",
  role: "heading",
  name: "Open-Source Software",
  loadingName: "Loading software",
  loadingQuery: "software-view=loading",
});
