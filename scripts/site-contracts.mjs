import { z } from "zod";

const siteRoutesSchema = z.array(
  z.object({
    path: z.string().startsWith("/"),
    label: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1),
    remote: z.string().min(1).optional(),
  }),
);

export function parseSiteRoutes(input) {
  return siteRoutesSchema.parse(input);
}
