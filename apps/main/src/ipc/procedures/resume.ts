import { z } from 'zod';
import { SessionId } from '@asf/domain';
import { publicProcedure, router } from '../trpc';

const ResumeCommandSchema = z.object({
  command: z.string(),
  workingDirectory: z.string().nullable(),
  hint: z.string(),
});

export const resumeRouter = router({
  buildCommand: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .output(ResumeCommandSchema.nullable())
    .query(({ input, ctx }) => ctx.app.resumeService.buildCommand(SessionId.from(input.sessionId))),
});
