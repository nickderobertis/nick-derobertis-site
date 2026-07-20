import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./gtag";

afterEach(() => Reflect.deleteProperty(window, "gtag"));
describe("trackEvent", () => {
  it("forwards typed events when gtag exists and is safe otherwise", () => {
    const gtag = vi.fn();
    Object.assign(window, { gtag });
    trackEvent({ name: "navigation", params: { route: "bio" } });
    expect(gtag).toHaveBeenCalledWith("event", "navigation", { route: "bio" });
    Reflect.deleteProperty(window, "gtag");
    expect(() => trackEvent({ name: "noop" })).not.toThrow();
  });
});
