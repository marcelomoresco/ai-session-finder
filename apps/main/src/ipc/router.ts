import { router } from './trpc';
import { searchRouter } from './procedures/search';
import { sessionRouter } from './procedures/session';
import { indexerRouter } from './procedures/indexer';
import { resumeRouter } from './procedures/resume';
import { settingsRouter } from './procedures/settings';
import { permissionsRouter } from './procedures/permissions';
import { systemRouter } from './procedures/system';
import { updateRouter } from './procedures/update';

export const appRouter = router({
  search: searchRouter,
  session: sessionRouter,
  indexer: indexerRouter,
  resume: resumeRouter,
  settings: settingsRouter,
  permissions: permissionsRouter,
  system: systemRouter,
  update: updateRouter,
});

/** Imported by the renderer (type-only) for end-to-end autocomplete. */
export type AppRouter = typeof appRouter;
