import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/home-cards/",
  role: "region",
  name: "Areas of work",
  loadingName: "Loading areas of work",
});
