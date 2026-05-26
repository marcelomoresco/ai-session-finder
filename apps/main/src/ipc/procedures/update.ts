import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const updateRouter = router({
  check: publicProcedure
    .output(z.object({ version: z.string() }).nullable())
    .query(({ ctx }) => ctx.app.updateService.checkForUpdates()),

  install: publicProcedure.mutation(({ ctx }) => ctx.app.updateService.downloadAndInstall()),
});
