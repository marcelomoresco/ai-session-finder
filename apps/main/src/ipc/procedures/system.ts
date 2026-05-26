import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const systemRouter = router({
  info: publicProcedure
    .output(z.object({ version: z.string(), platform: z.string() }))
    .query(({ ctx }) => ctx.app.appInfo),
});
