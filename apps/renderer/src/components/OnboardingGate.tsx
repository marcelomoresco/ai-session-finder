import type { ReactNode } from 'react';
import { trpc } from '../lib/trpc';
import { OnboardingPage } from '../pages/OnboardingPage';

/**
 * Shows the onboarding flow until `onboardingCompleted` is true, then the app.
 * This is what makes first run show onboarding — and what "Reset onboarding"
 * re-triggers by flipping the flag back to false.
 */
export function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const settings = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  if (!settings.data) {
    return null;
  }
  if (!settings.data.onboardingCompleted) {
    return <OnboardingPage onComplete={() => update.mutate({ onboardingCompleted: true })} />;
  }
  return <>{children}</>;
}
