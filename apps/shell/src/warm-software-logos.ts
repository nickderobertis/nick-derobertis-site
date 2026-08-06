// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route loader boundary and warms only the assets its own validated payload names.
import type { SoftwareProjects } from "@site/data-access-core";

// Warmed logos are kept alive here so the browser cannot collect an in-flight
// request, and so a repeated loader run never refetches an already warm URL.
const warmedSoftwareLogos = new Map<string, HTMLImageElement>();

/**
 * Software cards render `logo_base64` in preference to `logo_url`, so only the
 * external URLs cost a request. Warming them alongside the domain JSON means a
 * hovered Software link arrives with its visible card logos already decoded.
 */
export function warmSoftwareLogos(projects: SoftwareProjects) {
  if (typeof Image === "undefined") return;
  for (const project of projects) {
    const url = project.logo_base64 ? undefined : project.logo_url;
    if (!url || warmedSoftwareLogos.has(url)) continue;
    const image = new Image();
    warmedSoftwareLogos.set(url, image);
    image.src = url;
  }
}
