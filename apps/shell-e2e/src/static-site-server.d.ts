declare module "@site/static-site-server" {
  import type { Server } from "node:http";

  export function createStaticSiteServer(root: string): Server;
}
