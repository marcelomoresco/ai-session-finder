import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { ResumeButton } from './ResumeButton';

const COMMAND = { command: 'claude --resume abc123', workingDirectory: '/repo', hint: 'Run in terminal' };

function setInvoke(impl: (path: string) => Promise<unknown>): void {
  Object.defineProperty(window, 'trpc', {
    configurable: true,
    value: { invoke: vi.fn((path: string) => impl(path)) },
  });
}

describe('ResumeButton', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('launches the session via resume.run on click', async () => {
    let runCount = 0;
    setInvoke((path) => {
      if (path === 'resume.buildCommand') return Promise.resolve(COMMAND);
      if (path === 'resume.run') {
        runCount += 1;
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
    const user = userEvent.setup();

    render(
      <AppProviders>
        <ResumeButton sessionId="s1" />
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: /resume session/i }));

    await waitFor(() => expect(screen.getByText('✓ Opened')).toBeInTheDocument());
    expect(runCount).toBe(1);
  });

  it('copies the command to the clipboard', async () => {
    setInvoke((path) =>
      path === 'resume.buildCommand' ? Promise.resolve(COMMAND) : Promise.resolve(null),
    );
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(
      <AppProviders>
        <ResumeButton sessionId="s1" />
      </AppProviders>,
    );

    const copyButton = await screen.findByRole('button', { name: /copy command: claude/i });
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('claude --resume abc123');
  });
});
