import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { OnboardingGate } from './OnboardingGate';

const SETTINGS = {
  launcherShortcut: 'CommandOrControl+Shift+Space',
  theme: 'system',
  semanticSearchEnabled: true,
  autoStartOnLogin: false,
  onboardingCompleted: true,
  enabledSources: ['claude-code', 'codex-cli', 'cursor'],
  encryptDatabase: false,
};

function setSettings(over: Record<string, unknown>): void {
  Object.defineProperty(window, 'trpc', {
    configurable: true,
    value: {
      invoke: vi.fn((path: string) =>
        path === 'settings.get' ? Promise.resolve({ ...SETTINGS, ...over }) : Promise.resolve(null),
      ),
    },
  });
}

describe('OnboardingGate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('renders children once onboarding is complete', async () => {
    setSettings({ onboardingCompleted: true });
    render(
      <AppProviders>
        <OnboardingGate>
          <div>App ready</div>
        </OnboardingGate>
      </AppProviders>,
    );
    expect(await screen.findByText('App ready')).toBeInTheDocument();
  });

  it('renders onboarding (not children) when not yet complete', async () => {
    setSettings({ onboardingCompleted: false });
    render(
      <AppProviders>
        <OnboardingGate>
          <div>App ready</div>
        </OnboardingGate>
      </AppProviders>,
    );
    expect(await screen.findByText(/Welcome to AI Session Finder/)).toBeInTheDocument();
    expect(screen.queryByText('App ready')).not.toBeInTheDocument();
  });
});
