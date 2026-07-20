import { fileURLToPath } from "node:url";
import { createStaticSiteServer } from "./static-site-server.mjs";

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
createStaticSiteServer(root).listen(4200, "127.0.0.1");
