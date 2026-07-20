import { afterEach, describe, expect, it, vi } from "vitest";
import { cvDataClient, domainNames } from "./client";

afterEach(() => vi.unstubAllGlobals());
describe("cvDataClient", () => {
  it("exposes all six domains and validates records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('[{"name":"Example"}]')),
    );
    expect(domainNames).toHaveLength(6);
    await expect(cvDataClient.domain("research")).resolves.toEqual([
      { name: "Example" },
    ]);
  });
  it("rejects failed and malformed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("{}")),
    );
    await expect(cvDataClient.schema()).rejects.toThrow("404");
    await expect(cvDataClient.domain("bio")).rejects.toThrow();
  });
});
