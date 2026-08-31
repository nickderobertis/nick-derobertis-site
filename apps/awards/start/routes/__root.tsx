// eslint-disable-next-line @nx/enforce-module-boundaries -- Start's document must load the shared tokens before the route renders.
import "@site/design-system/styles.css";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { awardsPublicPath } from "../../start-contract";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Awards" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <base href={awardsPublicPath} />
        <HeadContent />
      </head>
      <body>
        <div id="root" data-prerendered-remote="awards">
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
