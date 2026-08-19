import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "shell",
  dir: "apps/shell",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  // Vitest has no Module Federation runtime, so the five route remotes the
  // shell's bootstrap imports resolve to the stand-ins beside it. Everything
  // under apps/shell/src stays the real thing. See apps/shell/test-remotes.
  remotes: {
    "home/Page": "apps/shell/test-remotes/home-page.tsx",
    "bio/Page": "apps/shell/test-remotes/bio-page.tsx",
    "research/Page": "apps/shell/test-remotes/research-page.tsx",
    "software/Page": "apps/shell/test-remotes/software-page.tsx",
    "courses/Page": "apps/shell/test-remotes/courses-page.tsx",
  },
  coverageInclude: ["apps/shell/src/**/*.{ts,tsx}"],
});
