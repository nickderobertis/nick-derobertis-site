import { z } from "zod";

export const fragmentContractSchemaVersion = 1;
const exactSemverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const fragmentContractSchema = z.strictObject({
  schemaVersion: z.literal(fragmentContractSchemaVersion),
  name: z.string().regex(/^[a-z][a-z-]*$/),
  react: z.string().regex(exactSemverPattern),
  reactDom: z.string().regex(exactSemverPattern),
  revision: z.string().regex(/^[0-9a-f]{7,64}$/),
  route: z
    .string()
    .regex(/^\/(?:[a-z0-9-]+)?$/)
    .optional(),
});

export type FragmentContract = z.infer<typeof fragmentContractSchema>;

export function serializeFragmentContract(contract: FragmentContract) {
  return `${JSON.stringify(fragmentContractSchema.parse(contract))}\n`;
}
