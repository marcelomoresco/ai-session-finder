import { z } from 'zod';

// NOTE: the Codex rollout event schema is NOT fully confirmed in the spec
// (only path/filename conventions are). These lenient schemas capture the most
// likely fields and tolerate everything else (z.object strips unknowns).
// Validate against real anonymized rollouts and tune as needed (Rule 2/5).

export const CodexContentBlockSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

export const CodexUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cached_input_tokens: z.number().optional(),
});

export const CodexJsonlEventSchema = z.object({
  type: z.string().optional(),
  timestamp: z.string().optional(),
  role: z.string().optional(),
  cwd: z.string().optional(),
  model: z.string().optional(),
  text: z.string().optional(),
  name: z.string().optional(),
  content: z.union([z.string(), z.array(CodexContentBlockSchema)]).optional(),
  usage: CodexUsageSchema.optional(),
});

export type CodexContentBlock = z.infer<typeof CodexContentBlockSchema>;
export type CodexJsonlEvent = z.infer<typeof CodexJsonlEventSchema>;
