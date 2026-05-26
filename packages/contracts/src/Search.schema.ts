import { z } from 'zod';
import { TOOLS } from '@asf/domain';

export const SearchFiltersSchema = z.object({
  tools: z.array(z.enum(TOOLS)).optional(),
  projectPath: z.string().optional(),
  after: z.date().optional(),
  before: z.date().optional(),
});

export const SearchQuerySchema = z.object({
  text: z.string().min(1).max(500),
  mode: z.enum(['quick', 'smart']).default('quick'),
  filters: SearchFiltersSchema.default({}),
  limit: z.number().int().positive().max(100).default(30),
});

export const BrowseActiveInputSchema = z.object({
  filters: SearchFiltersSchema.default({}),
  limit: z.number().int().positive().max(100).default(20),
});

export const SearchResultSchema = z.object({
  sessionId: z.string(),
  turnId: z.string(),
  snippet: z.string(),
  projectName: z.string().nullable(),
  tool: z.enum(TOOLS),
  lastActivityAt: z.date(),
  score: z.number(),
});

export type SearchQueryInput = z.input<typeof SearchQuerySchema>;
export type SearchQueryParsed = z.output<typeof SearchQuerySchema>;
