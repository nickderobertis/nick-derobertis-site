import { expect, type Page } from "@playwright/test";

export const navLink = (page: Page, label: string) =>
  page.getByRole("link", { name: label, exact: true });

/**
 * Hovers a header link until the router acts on it.
 *
 * Hover intent is edge-triggered: the router preloads when the pointer enters
 * the link, so a pointer already resting there when hydration attaches that
 * listener raises no entry at all, and waiting cannot recover an event that
 * never fired. `networkidle` reports the network rather than the main thread,
 * so on a loaded runner it arrives while hydration is still queued behind it
 * and that single hover is lost for good. The pointer therefore leaves the link
 * and comes back, the way a visitor's would, until the preload has started. It
 * rests on the route's own heading in between, which is text rather than a link
 * and so asks for nothing itself.
 *
 * Observing that request is also this harness's proof that the router owns the
 * document, which is what `hoverUntilHydrated` below is for: it cannot happen
 * until hydration attached the listener that raises it.
 */
export async function hoverUntilPreloading(
  page: Page,
  label: string,
  preloading: () => boolean,
) {
  const link = navLink(page, label);
  await link.hover();
  await expect
    .poll(async () => {
      if (preloading()) return true;
      await page.getByRole("heading", { level: 1 }).hover();
      await link.hover();
      // The router holds intent behind a short timer, so each entry is given
      // room to elapse before the next attempt moves the pointer off it again.
      await page.waitForTimeout(500);
      return preloading();
    })
    .toBe(true);
}

/**
 * Hovers a link until the router owns the document, then hands it back to
 * click. Before hydration attaches the router's handler an anchor is followed
 * for real, so a journey asserting that a click stayed in the document has to
 * wait for this; nothing it could assert on distinguishes the two, because the
 * DOM it checks is prerendered either way.
 *
 * `requestedRemote` reports whether the hovered route's remote has been asked
 * for; install its request recorder first. The hover leaves that remote
 * fetched, so call this only where the journey's next claim is that the remote
 * *was* loaded, never before one that it never was.
 */
export async function hoverUntilHydrated(
  page: Page,
  label: string,
  requestedRemote: () => boolean,
) {
  await hoverUntilPreloading(page, label, requestedRemote);
  return navLink(page, label);
}
