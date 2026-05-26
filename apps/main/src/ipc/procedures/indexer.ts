import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const IndexStatsSchema = z.object({
  indexed: z.number().int().nonnegative(),
  lastSync: z.date().nullable(),
});

export const indexerRouter = router({
  start: publicProcedure.mutation(({ ctx }) => {
    ctx.app.indexerService.start();
  }),
  fullReindex: publicProcedure.mutation(({ ctx }) => {
    ctx.app.indexerService.fullReindex();
  }),
  stop: publicProcedure.mutation(({ ctx }) => ctx.app.indexerService.stop()),
  stats: publicProcedure
    .output(IndexStatsSchema)
    .query(({ ctx }) => ctx.app.indexAdminService.stats()),
  clearIndex: publicProcedure.mutation(({ ctx }) => ctx.app.indexAdminService.clear()),
});
