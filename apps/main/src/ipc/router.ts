import { router } from './trpc';
import { searchRouter } from './procedures/search';
import { sessionRouter } from './procedures/session';
import { indexerRouter } from './procedures/indexer';
import { resumeRouter } from './procedures/resume';

export const appRouter = router({
  search: searchRouter,
  session: sessionRouter,
  indexer: indexerRouter,
  resume: resumeRouter,
});

/** Imported by the renderer (type-only) for end-to-end autocomplete. */
export type AppRouter = typeof appRouter;
