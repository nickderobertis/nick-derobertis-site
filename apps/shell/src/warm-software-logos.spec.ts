// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route-loader boundary; its spec warms the same validated payload the deployed loader receives.
import type { SoftwareProjects } from "@site/data-access-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
