import { z } from 'zod';
import { BrowseActiveInputSchema, SearchQuerySchema, SearchResultSchema } from '@asf/contracts';
import { publicProcedure, router } from '../trpc';
import type { SearchFilters } from '@asf/domain';

// Rebuild filters omitting absent keys: zod's optional inference yields
// `T | undefined`, which exactOptionalPropertyTypes rejects for SearchFilters.
function toFilters(input: {
  tools?: SearchFilters['tools'];
  projectPath?: string | undefined;
  after?: Date | undefined;
  before?: Date | undefined;
}): SearchFilters {
  return {
    ...(input.tools ? { tools: input.tools } : {}),
    ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
    ...(input.before !== undefined ? { before: input.before } : {}),
  };
}

export const searchRouter = router({
  query: publicProcedure
    .input(SearchQuerySchema)
    .output(z.array(SearchResultSchema).readonly())
    .query(({ input, ctx }) =>
      ctx.app.searchService.search({
        text: input.text,
        mode: input.mode,
        limit: input.limit,
        filters: toFilters(input.filters),
      }),
    ),

  browseActive: publicProcedure
    .input(BrowseActiveInputSchema)
    .output(z.array(SearchResultSchema).readonly())
    .query(({ input, ctx }) =>
      ctx.app.searchService.browseActive(toFilters(input.filters), input.limit),
    ),
});
