import { expect, type Page } from "@playwright/test";

/** A header link, as a visitor reaches it. */
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
 * Observing that preload request is also this harness's proof that the router
 * owns the document, which is what `hydrated` below is for: the request cannot
 * happen until hydration attached the listener that raises it.
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
 * Waits until the router owns the document, then hands back the link that
 * proved it so the caller can click it.
 *
 * A click is only an SPA transition once hydration has attached the router's
 * handler to the anchor; before that the browser follows the href and costs a
 * real document request. Nothing a locator can sample says which side of that
 * line a page is on — the prerendered DOM a journey asserts on is already
 * visible, and `networkidle` reports the network rather than the main thread —
 * so a journey that clicks straight after `goto` is deciding a race, and loses
 * it on a loaded runner.
 *
 * The barrier is behavioural rather than a sleep or a poke at internal state:
 * hover the link the visitor is about to click, and wait for the router's own
 * preload of that route to be requested. That request is raised by a listener
 * only hydration can have attached, so seeing one *is* the proof.
 *
 * `requestedRemote` reports whether the hovered route's remote has been asked
 * for. Install its request recorder before calling this, and note that the
 * hover leaves that remote fetched: use this before assertions that the remote
 * *was* loaded, never before ones that it never was.
 */
export async function hydrated(
  page: Page,
  label: string,
  requestedRemote: () => boolean,
) {
  await hoverUntilPreloading(page, label, requestedRemote);
  return navLink(page, label);
}
