import { z } from "zod";

export const fragmentContractSchemaVersion = 1;

export const fragmentContractSchema = z.strictObject({
  schemaVersion: z.literal(fragmentContractSchemaVersion),
  name: z.string().regex(/^[a-z][a-z-]*$/),
  react: z.string().min(1),
  reactDom: z.string().min(1),
  revision: z.string().min(1),
  route: z
    .string()
    .regex(/^\/(?:[a-z0-9-]+)?$/)
    .optional(),
});

export type FragmentContract = z.infer<typeof fragmentContractSchema>;

export function serializeFragmentContract(contract: FragmentContract) {
  return `${JSON.stringify(fragmentContractSchema.parse(contract))}\n`;
}
