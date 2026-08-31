import { remoteOwnershipTests } from "@site/e2e-harness";

// llmlint: ignore-file[e2e_not_mocked] The remote-code fixture delays only the arrival of Home's real built page chunk and substitutes nothing for it. The browser performs the same standalone and host-composed navigations, while the harness's held-response assertion proves that actual page code reached the fixture.
// llmlint: ignore-file[tests_mirror_real_usage] Home opts into the deterministic response hold so its real loading state remains observable on busy machines where preload otherwise wins the race. The visitor-facing navigation, production artifact, and rendered fallback are unchanged; only delivery of the real page chunk is delayed.
// llmlint: ignore[browser_journeys_run_against_the_built_app] This workspace owns each remote's browser journeys on that app's Nx e2e target, and `home:e2e` depends on the production prerender before Playwright opens either the built standalone document or the host-composed artifact; changing project ownership would not change the deployed bytes these real navigations drive.
remoteOwnershipTests("home", { holdStandalonePageCode: true });
