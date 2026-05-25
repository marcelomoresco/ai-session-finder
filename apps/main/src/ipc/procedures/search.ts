import { z } from 'zod';
import { SearchQuerySchema, SearchResultSchema } from '@asf/contracts';
import { publicProcedure, router } from '../trpc';

export const searchRouter = router({
  query: publicProcedure
    .input(SearchQuerySchema)
    .output(z.array(SearchResultSchema).readonly())
    // Rebuild filters omitting absent keys: zod's optional inference yields
    // `T | undefined`, which exactOptionalPropertyTypes rejects for SearchFilters.
    .query(({ input, ctx }) =>
      ctx.app.searchService.search({
        text: input.text,
        mode: input.mode,
        limit: input.limit,
        filters: {
          ...(input.filters.tools ? { tools: input.filters.tools } : {}),
          ...(input.filters.projectPath !== undefined
            ? { projectPath: input.filters.projectPath }
            : {}),
          ...(input.filters.after !== undefined ? { after: input.filters.after } : {}),
          ...(input.filters.before !== undefined ? { before: input.filters.before } : {}),
        },
      }),
    ),
});
