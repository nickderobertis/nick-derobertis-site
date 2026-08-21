// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route-loader boundary; its spec warms the same validated payload the deployed loader receives.
import type { SoftwareProjects } from "@site/data-access-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/**
 * The ceiling every test below is held to, because each reaches its subject
 * through `await import(...)` and `vi.resetModules()` makes it pay for that
 * import afresh rather than reusing the last test's evaluation. What that costs
 * is the subject's whole transitive graph being evaluated again — a cost set by
 * the workspace's size and the host's load, not by this file: 90ms to 1.4s per
 * test measured idle, reaching 5.6s and then 12.6s under the contention
 * `nx affected --parallel=3` puts the gate under, which is past the runner's
 * 5000ms default. It is set far past anything that import can cost rather than
 * past today's contention — one chosen to clear a busy evening fails again on a
 * busier one — so it still bounds a genuine hang and nothing else.
 */
const evaluatesAModuleGraph = { timeout: 120_000 };

type Project = SoftwareProjects[number];

/**
 * Records every URL the browser is asked to decode. The image element is the
 * warming boundary, so recording it is how "one request per logo" is observed.
 */
function watchImageRequests() {
  const requested: string[] = [];
  vi.stubGlobal(
    "Image",
    class {
      set src(value: string) {
        requested.push(value);
      }
    },
  );
  return requested;
}

function project(overrides: Partial<Project>): Project {
  return {
    id: "a-project",
    name: "A project",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test(
  "warms the logos a card would otherwise fetch when it mounts",
  evaluatesAModuleGraph,
  async () => {
    const requested = watchImageRequests();
    const { warmSoftwareLogos } = await import("./warm-software-logos");

    warmSoftwareLogos([
      project({ id: "one", logo_url: "https://example.invalid/one.png" }),
      project({ id: "two", logo_url: "https://example.invalid/two.png" }),
    ]);

    expect(requested).toEqual([
      "https://example.invalid/one.png",
      "https://example.invalid/two.png",
    ]);
  },
);

test(
  "leaves an inlined logo alone, because it costs no request",
  evaluatesAModuleGraph,
  async () => {
    const requested = watchImageRequests();
    const { warmSoftwareLogos } = await import("./warm-software-logos");

    warmSoftwareLogos([
      project({
        id: "inlined",
        logo_base64: "data:image/png;base64,AAAA",
        logo_url: "https://example.invalid/inlined.png",
      }),
      project({ id: "no-logo" }),
    ]);

    expect(requested).toEqual([]);
  },
);

test(
  "asks for a logo once, however often the route loader runs",
  evaluatesAModuleGraph,
  async () => {
    const requested = watchImageRequests();
    const { warmSoftwareLogos } = await import("./warm-software-logos");
    const projects = [
      project({ id: "one", logo_url: "https://example.invalid/one.png" }),
    ];

    warmSoftwareLogos(projects);
    warmSoftwareLogos(projects);

    expect(requested).toEqual(["https://example.invalid/one.png"]);
  },
);

test(
  "warms nothing where there is no browser to decode an image",
  evaluatesAModuleGraph,
  async () => {
    const requested = watchImageRequests();
    const { warmSoftwareLogos } = await import("./warm-software-logos");
    vi.stubGlobal("Image", undefined);

    warmSoftwareLogos([
      project({ id: "one", logo_url: "https://example.invalid/one.png" }),
    ]);

    expect(requested).toEqual([]);
  },
);
