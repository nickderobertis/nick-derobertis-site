import { describe, expect, test } from "vitest";
import {
  extractStartFragment,
  rewriteStartAssetReferences,
} from "../start-output";

describe("Awards Start output adapter", () => {
  test("extracts Start's resolved prerender root", () => {
    expect(
      extractStartFragment(
        '<html><div id="root" data-prerendered-remote="awards"><!--$--><section aria-label="Selected awards">resolved</section><!--/$--></div><script class="$tsr"></script></html>',
      ),
    ).toBe('<section aria-label="Selected awards">resolved</section>');
  });

  test("rejects the loading fallback that cannot hydrate as the fragment", () => {
    expect(() =>
      extractStartFragment(
        '<html><div id="root" data-prerendered-remote="awards"><section aria-label="Loading awards">loading</section></div><script class="$tsr"></script></html>',
      ),
    ).toThrow("resolved Awards content");
  });

  test("makes Start route chunks relative to the remote base", () => {
    expect(
      rewriteStartAssetReferences(
        'href="/421.abc123.js";preloads:["/421.abc123.js"]',
      ),
    ).toBe('href="421.abc123.js";preloads:["421.abc123.js"]');
  });
});
