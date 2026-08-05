import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/awards/",
  role: "heading",
  name: "Selected awards",
  loadingName: "Loading awards",
});
