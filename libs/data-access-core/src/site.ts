import { z } from "zod";
import { pagesBasePattern } from "./pages-base-pattern.ts";
import siteConfigInput from "./site.config.json" with { type: "json" };
export const siteBase = z
  .object({ pagesBase: z.string().regex(pagesBasePattern) })
  .parse(siteConfigInput).pagesBase;
