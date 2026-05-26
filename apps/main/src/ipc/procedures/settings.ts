import { z } from 'zod';
import { TOOLS } from '@asf/domain';
import type { AppSettings } from '../../services/Settings';
import { publicProcedure, router } from '../trpc';

const AppSettingsSchema = z.object({
  launcherShortcut: z.string(),
  theme: z.enum(['system', 'light', 'dark']),
  semanticSearchEnabled: z.boolean(),
  autoStartOnLogin: z.boolean(),
  onboardingCompleted: z.boolean(),
  enabledSources: z.array(z.enum(TOOLS)).readonly(),
  encryptDatabase: z.boolean(),
});

const AppSettingsPatchSchema = AppSettingsSchema.partial();

export const settingsRouter = router({
  get: publicProcedure.output(AppSettingsSchema).query(({ ctx }) => ctx.app.settingsService.get()),

  update: publicProcedure
    .input(AppSettingsPatchSchema)
    .output(AppSettingsSchema)
    .mutation(({ input, ctx }) => {
      // Rebuild a clean patch (exactOptionalPropertyTypes forbids `key: undefined`).
      const patch: Partial<AppSettings> = {
        ...(input.launcherShortcut !== undefined ? { launcherShortcut: input.launcherShortcut } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.semanticSearchEnabled !== undefined
          ? { semanticSearchEnabled: input.semanticSearchEnabled }
          : {}),
        ...(input.autoStartOnLogin !== undefined
          ? { autoStartOnLogin: input.autoStartOnLogin }
          : {}),
        ...(input.onboardingCompleted !== undefined
          ? { onboardingCompleted: input.onboardingCompleted }
          : {}),
        ...(input.enabledSources !== undefined ? { enabledSources: input.enabledSources } : {}),
        ...(input.encryptDatabase !== undefined ? { encryptDatabase: input.encryptDatabase } : {}),
      };
      return ctx.app.applySettings(patch);
    }),
});
