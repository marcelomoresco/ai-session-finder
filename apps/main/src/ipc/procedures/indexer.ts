import { publicProcedure, router } from '../trpc';

export const indexerRouter = router({
  start: publicProcedure.mutation(({ ctx }) => {
    ctx.app.indexerService.start();
  }),
  fullReindex: publicProcedure.mutation(({ ctx }) => {
    ctx.app.indexerService.fullReindex();
  }),
  stop: publicProcedure.mutation(({ ctx }) => ctx.app.indexerService.stop()),
});
