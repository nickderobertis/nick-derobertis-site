import { z } from "zod";
import siteConfigInput from "./site.config.json";
export const siteBase = z
  .object({ pagesBase: z.string().regex(/^\/[a-z0-9-]+$/) })
  .parse(siteConfigInput).pagesBase;
