import { z } from 'zod';
import { TOOLS } from '@asf/domain';

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0),
  cacheCreationTokens: z.number().int().min(0),
});

export const SessionSchema = z.object({
  id: z.string().min(1),
  tool: z.enum(TOOLS),
  sourceId: z.string().min(1),
  projectPath: z.string().nullable(),
  projectName: z.string().nullable(),
  gitBranch: z.string().nullable(),
  startedAt: z.date(),
  lastActivityAt: z.date(),
  turnCount: z.number().int().min(0),
  model: z.string().nullable(),
  tokenUsage: TokenUsageSchema,
  filePath: z.string().min(1),
  fileMtime: z.number().int().min(0),
  indexedAt: z.date(),
});

export type SessionInput = z.input<typeof SessionSchema>;
export type SessionParsed = z.output<typeof SessionSchema>;
