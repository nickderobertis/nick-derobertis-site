import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "research",
  standalone: "remotes/research/",
  role: "heading",
  name: "Research Works",
  loadingName: "Loading research",
  loadingQuery: "research-scenario=loading",
});
