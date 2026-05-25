import { z } from 'zod';

// Lenient schemas: z.object strips unknown keys (tolerating extra/new fields)
// and optionals tolerate missing ones (old Claude Code versions).

export const ClaudeUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
});

export const ClaudeContentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  thinking: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

export const ClaudeMessageSchema = z.object({
  role: z.string().optional(),
  model: z.string().optional(),
  content: z.union([z.string(), z.array(ClaudeContentBlockSchema)]).optional(),
  usage: ClaudeUsageSchema.optional(),
});

export const ClaudeJsonlEventSchema = z.object({
  type: z.string().optional(),
  timestamp: z.string().optional(),
  sessionId: z.string().optional(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  version: z.string().optional(),
  message: ClaudeMessageSchema.optional(),
});

export type ClaudeUsage = z.infer<typeof ClaudeUsageSchema>;
export type ClaudeContentBlock = z.infer<typeof ClaudeContentBlockSchema>;
export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>;
export type ClaudeJsonlEvent = z.infer<typeof ClaudeJsonlEventSchema>;
