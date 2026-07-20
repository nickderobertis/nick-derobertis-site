import { remoteConfig } from "@site/build-config";
export default remoteConfig("home", {
  remotes: {
    homeCarousel:
      "homeCarousel@/nick-derobertis-site/remotes/home-carousel/remoteEntry.js",
    homeCards:
      "homeCards@/nick-derobertis-site/remotes/home-cards/remoteEntry.js",
    homeStory:
      "homeStory@/nick-derobertis-site/remotes/home-story/remoteEntry.js",
    homeContact:
      "homeContact@/nick-derobertis-site/remotes/home-contact/remoteEntry.js",
  },
});
