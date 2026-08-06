import { defineWorkspaceTestConfig } from "@site/testing";

// Home is a host: every pane it composes arrives through a federation
// specifier that only rspack can resolve. Each one is pointed at the sibling
// app's own source, so the composed page is exercised against the real panes
// rather than against stand-ins that could agree with a broken host.
export default defineWorkspaceTestConfig({
  project: "home",
  dir: "apps/home",
  remotes: {
    "homeCarousel/Page": "apps/home-carousel/src/page.tsx",
    "homeCarousel/Skeleton": "apps/home-carousel/src/skeleton.tsx",
    "homeCards/Page": "apps/home-cards/src/page.tsx",
    "homeCards/Skeleton": "apps/home-cards/src/skeleton.tsx",
    "homeStory/Page": "apps/home-story/src/page.tsx",
    "homeStory/Skeleton": "apps/home-story/src/skeleton.tsx",
    "homeContact/Page": "apps/home-contact/src/page.tsx",
    "homeContact/Skeleton": "apps/home-contact/src/skeleton.tsx",
    "timeline/Page": "apps/timeline/src/page.tsx",
    "timeline/Skeleton": "apps/timeline/src/skeleton.tsx",
    "skills/Page": "apps/skills/src/page.tsx",
    "skills/Skeleton": "apps/skills/src/skeleton.tsx",
    "awards/Page": "apps/awards/src/page.tsx",
    "awards/Skeleton": "apps/awards/src/skeleton.tsx",
  },
});
