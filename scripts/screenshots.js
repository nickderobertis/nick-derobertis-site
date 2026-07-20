const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('playwright');
const config = require('../playwright.config');

const routes = {
  home: '/',
  bio: '/bio',
  research: '/research',
  software: '/software',
  courses: '/courses',
};

const homePanes = {
  carousel: 'nds-home-carousel',
  'home-cards': '.marketing > .row:first-of-type',
  'story-teaser': 'nds-home-story',
  timeline: 'nds-timeline-pane',
  'skills-sunburst': 'nds-skills-pane',
  awards: 'nds-awards-pane',
  contact: 'nds-contact-pane',
};

const deterministicStyles = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
`;

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: config.settleTimeout });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }),
        ),
    );
  });
  await page.addStyleTag({ content: deterministicStyles });
}

async function open(page, route) {
  await page.goto(new URL(route, config.baseURL).href, {
    timeout: config.navigationTimeout,
    waitUntil: 'domcontentloaded',
  });
  await settle(page);
}

async function save(pageOrLocator, segments, options = {}) {
  const outputPath = path.join(config.outputDirectory, ...segments);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await pageOrLocator.screenshot({
    animations: 'disabled',
    path: outputPath,
    ...options,
  });
}

async function captureRoutes(page, viewportName) {
  for (const [routeName, route] of Object.entries(routes)) {
    await open(page, route);
    await save(page, ['routes', routeName, `${viewportName}.png`], {
      fullPage: true,
    });
  }
}

async function captureHome(page, viewportName) {
  await open(page, '/');
  await page.getByText('Selenium', { exact: true }).first().waitFor({
    state: 'visible',
    timeout: config.settleTimeout,
  });
  await page.locator('nds-award-card').first().waitFor({
    state: 'visible',
    timeout: config.settleTimeout,
  });

  // Stop Bootstrap's automatic carousel timer on the first, canonical slide.
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#myCarousel .carousel-item'));
    items.forEach((item, index) => item.classList.toggle('active', index === 0));
    document.querySelectorAll('#myCarousel .carousel-indicators li').forEach(
      (indicator, index) => indicator.classList.toggle('active', index === 0),
    );
    document.querySelector('#myCarousel')?.removeAttribute('data-ride');
  });

  for (const [paneName, selector] of Object.entries(homePanes)) {
    const pane = page.locator(selector).first();
    await pane.scrollIntoViewIfNeeded();
    await save(pane, ['home-panes', paneName, `${viewportName}.png`]);
  }

  await page.locator('#myCarousel .carousel-indicators li').nth(1).click();
  await save(page.locator('nds-home-carousel'), [
    'home-panes',
    'carousel',
    `${viewportName}-rotated.png`,
  ]);

  const skillSlice = page.locator('nds-skills-chart g.slice').filter({
    has: page.locator('text[data-unformatted="Programming"]'),
  }).first();
  await skillSlice.hover();
  await save(page.locator('nds-skills-pane'), [
    'home-panes',
    'skills-sunburst',
    `${viewportName}-hover.png`,
  ]);
  await skillSlice.click();
  await page.locator('nds-skills-chart text[data-unformatted="Python"]').first().waitFor({
    state: 'visible',
    timeout: config.settleTimeout,
  });
  await save(page.locator('nds-skills-pane'), [
    'home-panes',
    'skills-sunburst',
    `${viewportName}-expanded.png`,
  ]);

  await page.locator('#timeline-education-checkbox').uncheck();
  await save(page.locator('nds-timeline-pane'), [
    'home-panes',
    'timeline',
    `${viewportName}-employment-filtered.png`,
  ]);
}

async function main() {
  await fs.mkdir(config.outputDirectory, { recursive: true });
  await Promise.all(
    ['routes', 'home-panes'].map((directory) =>
      fs.rm(path.join(config.outputDirectory, directory), {
        force: true,
        recursive: true,
      }),
    ),
  );
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [viewportName, viewport] of Object.entries(config.viewports)) {
      const context = await browser.newContext({
        colorScheme: 'light',
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        viewport,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(config.settleTimeout);
      await captureRoutes(page, viewportName);
      await captureHome(page, viewportName);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
