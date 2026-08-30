import { cvDataClient } from "@site/data-access-core/bundled";
import { act, renderHook, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AwardsViewState } from "./use-awards";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

const awards = cvDataClient.domain("awards");
let requested: URL[] = [];

/**
 * Stands in for the Pages host that serves the CV domains, which is the only
 * boundary this hook has. Every request it answers is recorded, because "one
 * request per URL" is half of what the hook promises its hosts.
 */
function serveAwards(respond: (url: URL) => Promise<Response>) {
  const server = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requested.push(url);
    return await respond(url);
  });
  vi.stubGlobal("fetch", server);
  return server;
}

function awardsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  requested = [];
  vi.resetModules();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test(
  "settles from its loading frame to the awards the CV publishes",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () => awardsResponse(awards));
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    expect(result.current).toEqual({ name: "loading" });
    await waitFor(() =>
      expect(result.current).toEqual({ name: "ready", awards }),
    );
    expect(requested).toHaveLength(1);
    expect(requested[0]?.pathname).toBe(
      "/nick-derobertis-site/cv-data/domains/awards.json",
    );
    expect(requested[0]?.search).toBe("");
  },
);

test(
  "reports an error when the awards domain cannot be served",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () =>
      awardsResponse({ error: "awards unavailable" }, 503),
    );
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() => expect(result.current).toEqual({ name: "error" }));
  },
);

test(
  "refuses a body the server itself reported as a failure",
  moduleGraphCeiling,
  async () => {
    // A cache or gateway can answer a failed request with the last payload it
    // held, so the status is the only thing saying this is not the answer.
    serveAwards(async () => awardsResponse(awards, 503));
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() => expect(result.current).toEqual({ name: "error" }));
  },
);

test(
  "refuses a failed response without reading its body",
  moduleGraphCeiling,
  async () => {
    // The body of a failed response is not an answer, so the pane may not read
    // it. This one refuses to be read and counts the attempt, so a pane that
    // reached for it is caught here rather than settling on the same error
    // state for the wrong reason.
    let bodyReads = 0;
    const refuseBody = () => {
      bodyReads += 1;
      return Promise.reject(new Error("the failed awards body was read"));
    };
    serveAwards(async () =>
      Object.assign(awardsResponse(awards, 503), {
        json: refuseBody,
        text: refuseBody,
      }),
    );
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() => expect(result.current).toEqual({ name: "error" }));
    expect(bodyReads).toBe(0);
  },
);

test(
  "reports an error rather than rendering awards that failed the CV schema",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () => awardsResponse([{ id: 42 }]));
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() => expect(result.current).toEqual({ name: "error" }));
  },
);

test(
  "asks for the served scenario a visitor steered the pane into",
  moduleGraphCeiling,
  async () => {
    window.history.replaceState(null, "", "/?awards-scenario=empty");
    serveAwards(async () => awardsResponse([]));
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() =>
      expect(result.current).toEqual({ name: "ready", awards: [] }),
    );
    expect(requested[0]?.searchParams.get("scenario")).toBe("empty");
  },
);

test(
  "ignores a scenario the served data cannot answer",
  moduleGraphCeiling,
  async () => {
    window.history.replaceState(null, "", "/?awards-scenario=whatever");
    serveAwards(async () => awardsResponse(awards));
    const { useAwards } = await import("./use-awards");

    const { result } = renderHook(() => useAwards());

    await waitFor(() =>
      expect(result.current).toEqual({ name: "ready", awards }),
    );
    expect(requested[0]?.searchParams.get("scenario")).toBeNull();
  },
);

test(
  "mounts on its awards, with no loading frame, when a host warmed the pane",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () => awardsResponse(awards));
    const { preloadAwards, useAwards } = await import("./use-awards");
    await preloadAwards();

    const { result } = renderHook(() => useAwards());

    expect(result.current).toEqual({ name: "ready", awards });
    expect(requested).toHaveLength(1);
  },
);

test(
  "lets the pane make its own request after a warm that could not reach the CV",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () =>
      awardsResponse({ error: "awards unavailable" }, 503),
    );
    const { preloadAwards, useAwards } = await import("./use-awards");

    await expect(preloadAwards()).resolves.toBeUndefined();

    expect(requested).toHaveLength(1);
    const { result } = renderHook(() => useAwards());
    await waitFor(() => expect(result.current).toEqual({ name: "error" }));
    expect(requested).toHaveLength(2);
  },
);

test(
  "keeps one request alive when a pane unmounts before it settles",
  moduleGraphCeiling,
  async () => {
    let serve: (() => void) | undefined;
    serveAwards(async () => {
      await new Promise<void>((resolve) => {
        serve = resolve;
      });
      return awardsResponse(awards);
    });
    const { useAwards } = await import("./use-awards");

    const abandoned = renderHook(() => useAwards());
    expect(abandoned.result.current).toEqual({ name: "loading" });
    abandoned.unmount();
    const remounted = renderHook(() => useAwards());
    await act(async () => {
      serve?.();
    });

    await waitFor(() =>
      expect(remounted.result.current).toEqual({ name: "ready", awards }),
    );
    expect(abandoned.result.current).toEqual({ name: "loading" });
    expect(requested).toHaveLength(1);
  },
);

test(
  "lets the next mount retry a request that failed after its pane left",
  moduleGraphCeiling,
  async () => {
    let refuse: (() => void) | undefined;
    let served = 0;
    serveAwards(async () => {
      served += 1;
      if (served === 1)
        await new Promise<void>((_resolve, reject) => {
          refuse = () => reject(new Error("awards unavailable"));
        });
      return awardsResponse(awards);
    });
    const { useAwards } = await import("./use-awards");

    const abandoned = renderHook(() => useAwards());
    abandoned.unmount();
    await act(async () => {
      refuse?.();
    });

    expect(abandoned.result.current).toEqual({ name: "loading" });
    const remounted = renderHook(() => useAwards());
    await waitFor(() =>
      expect(remounted.result.current).toEqual({ name: "ready", awards }),
    );
    expect(requested).toHaveLength(2);
  },
);

test(
  "does not warm from the fragment prerender, which has no browser to fetch from",
  moduleGraphCeiling,
  async () => {
    const server = serveAwards(async () => awardsResponse(awards));
    const { preloadAwards } = await import("./use-awards");
    vi.stubGlobal("window", undefined);

    await expect(preloadAwards()).resolves.toBeUndefined();

    expect(server).not.toHaveBeenCalled();
  },
);

test(
  "starts on its loading frame when the fragment prerender renders it",
  moduleGraphCeiling,
  async () => {
    serveAwards(async () => awardsResponse(awards));
    const { useAwards } = await import("./use-awards");
    const Probe = () => {
      const state: AwardsViewState = useAwards();
      return createElement("output", null, state.name);
    };
    vi.stubGlobal("window", undefined);

    const { prelude } = await prerender(createElement(Probe));
    const html = await new Response(prelude).text();

    vi.unstubAllGlobals();
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(within(container).getByRole("status")).toHaveTextContent("loading");
  },
);
