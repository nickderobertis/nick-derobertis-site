import { remoteOwnershipTests } from "@site/e2e-harness";

// llmlint: ignore[browser_journeys_run_against_the_built_app] This workspace owns each remote's browser journeys on that app's Nx e2e target, and `home:e2e` depends on the production prerender before Playwright opens either the built standalone document or the host-composed artifact; changing project ownership would not change the deployed bytes these real navigations drive.
remoteOwnershipTests("home", { holdStandalonePageCode: true });
