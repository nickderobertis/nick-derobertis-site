import { remoteConfig, remoteMap } from "@site/build-config";
export default remoteConfig("home", {
  remotes: remoteMap([
    "home-carousel",
    "home-cards",
    "home-story",
    "home-contact",
    "timeline",
    "skills",
  ]),
});
