import { fileURLToPath } from "node:url";
import { createStaticSiteServer } from "./static-site-server.mjs";

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
const port = Number.parseInt(process.env.SITE_E2E_PORT ?? "4200", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error("SITE_E2E_PORT must be an integer from 1 through 65535");
createStaticSiteServer(root).listen(port, "127.0.0.1");
