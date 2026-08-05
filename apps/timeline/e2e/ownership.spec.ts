import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/timeline/",
  role: "heading",
  name: "Educated and Experienced",
  loadingName: "Loading timeline",
});
