import { z } from 'zod';
import { SessionSchema, TurnSchema } from '@asf/contracts';
import { SessionId, TOOLS } from '@asf/domain';
import { publicProcedure, router } from '../trpc';

// Composed from existing contract schemas (string ids) so branded domain ids
// never leak past the IPC boundary.
const SessionDetailSchema = z.object({
  session: SessionSchema,
  turns: z.array(TurnSchema).readonly(),
});

const SessionListFilterSchema = z.object({
  tools: z.array(z.enum(TOOLS)).optional(),
  projectPath: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const sessionRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(SessionDetailSchema.nullable())
    .query(async ({ input, ctx }) => {
      const detail = await ctx.app.sessionService.findById(SessionId.from(input.id));
      if (!detail) {
        return null;
      }
      // Copy the readonly turn arrays into mutable ones to match the schema's
      // input type (the contract's TurnSchema arrays are mutable).
      return {
        session: detail.session,
        turns: detail.turns.map((turn) => ({
          ...turn,
          toolCalls: [...turn.toolCalls],
          filesTouched: [...turn.filesTouched],
        })),
      };
    }),

  list: publicProcedure
    .input(SessionListFilterSchema.default({}))
    .output(z.array(SessionSchema).readonly())
    // Rebuild the filter omitting absent keys (exactOptionalPropertyTypes forbids
    // the `key: undefined` that zod's optional inference produces).
    .query(({ input, ctx }) =>
      ctx.app.sessionService.list({
        ...(input.tools ? { tools: input.tools } : {}),
        ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.offset !== undefined ? { offset: input.offset } : {}),
      }),
    ),
});
