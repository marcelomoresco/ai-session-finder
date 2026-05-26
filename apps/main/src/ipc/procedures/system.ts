import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { availableApps } from '../../services/availableApps';

export const systemRouter = router({
  info: publicProcedure
    .output(z.object({ version: z.string(), platform: z.string() }))
    .query(({ ctx }) => ctx.app.appInfo),

  /** Apps installed on this machine that a session can be opened in. */
  availableApps: publicProcedure
    .output(z.array(z.enum(['terminal', 'iterm', 'vscode', 'intellij', 'cursor'])).readonly())
    .query(() => availableApps()),
});
