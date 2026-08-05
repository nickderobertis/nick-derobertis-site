import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/home-carousel/",
  role: "region",
  name: "Featured work",
  loadingName: "Loading featured work",
});
