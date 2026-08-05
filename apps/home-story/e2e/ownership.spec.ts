import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/home-story/",
  role: "heading",
  name: "Who am I?",
  loadingName: "Loading story",
});
