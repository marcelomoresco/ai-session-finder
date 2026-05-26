import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const permissionsRouter = router({
  fullDiskAccess: publicProcedure
    .output(z.boolean())
    .query(({ ctx }) => ctx.app.permissionsService.hasFullDiskAccess()),

  openSettings: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.app.permissionsService.openSystemSettings();
  }),
});
