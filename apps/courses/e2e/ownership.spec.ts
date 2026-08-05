import { remoteOwnershipTests } from "@site/e2e-harness";

remoteOwnershipTests({
  host: "courses",
  standalone: "remotes/courses/",
  role: "heading",
  name: "Courses",
  loadingName: "Loading courses",
  loadingQuery: "courses-view=loading",
});
