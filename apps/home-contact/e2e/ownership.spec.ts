import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "",
  standalone: "remotes/home-contact/",
  role: "heading",
  name: "Let’s build something useful.",
  loadingName: "Loading contact options",
});
