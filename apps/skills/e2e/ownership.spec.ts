import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/skills/",
  role: "heading",
  name: "Skilled in…",
  loadingName: "Loading skills",
});
