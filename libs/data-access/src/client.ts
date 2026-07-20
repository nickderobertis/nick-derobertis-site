import { z } from "zod";

// TODO: replace the git dependency with @nickderobertis/cv-data from npm once its release CI publishes it.
export const domainNames = [
  "awards",
  "bio",
  "courses",
  "education",
  "research",
  "software",
] as const;
export type CvDomain = (typeof domainNames)[number];
const domainSchema = z.array(z.record(z.string(), z.unknown()));
export type DomainData = z.infer<typeof domainSchema>;
export interface CvDataClient {
  domain(name: CvDomain): Promise<DomainData>;
  schema(): Promise<unknown>;
}
async function loadJson(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok)
    throw new Error(`CV data request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}
export const cvDataClient: CvDataClient = {
  async domain(name) {
    return domainSchema.parse(await loadJson(`/data/${name}.json`));
  },
  async schema() {
    return loadJson("/schema");
  },
};
