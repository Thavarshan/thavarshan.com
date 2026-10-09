import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const applicationStateEntrySchema = z.object({
  opportunityId: z.string(),
  inputHash: z.string(),
  generatedAt: z.string().datetime(),
  model: z.string(),
  status: z.enum(["pending", "applied", "skipped"]).default("pending"),
  respondedAt: z.string().datetime().nullable().default(null)
});

export const applicationStateSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(applicationStateEntrySchema)
});

export type ApplicationStateEntry = z.infer<typeof applicationStateEntrySchema>;
export type ApplicationState = z.infer<typeof applicationStateSchema>;

const emptyState: ApplicationState = { schemaVersion: 1, entries: [] };

export async function readState(dir: string): Promise<ApplicationState> {
  try {
    return applicationStateSchema.parse(JSON.parse(await readFile(resolve(dir, "state.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...emptyState };
    throw new Error("Invalid private application state; restore state.json before generating packages", { cause: error });
  }
}

export async function writeState(dir: string, state: ApplicationState): Promise<void> {
  await writeFile(resolve(dir, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
