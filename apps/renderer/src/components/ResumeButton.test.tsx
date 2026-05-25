import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { ResumeButton } from './ResumeButton';

function setInvoke(invoke: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'trpc', { configurable: true, value: { invoke } });
}

describe('ResumeButton', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('copies the resume command to the clipboard and shows feedback', async () => {
    setInvoke(
      vi.fn().mockResolvedValue({
        command: 'claude --resume abc123',
        workingDirectory: '/repo',
        hint: 'Run in terminal',
      }),
    );
    const user = userEvent.setup();
    // Override AFTER setup(), which installs its own clipboard stub.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(
      <AppProviders>
        <ResumeButton sessionId="s1" />
      </AppProviders>,
    );

    const button = await screen.findByRole('button', { name: /claude --resume abc123/i });
    await user.click(button);

    expect(writeText).toHaveBeenCalledWith('claude --resume abc123');
    expect(await screen.findByText(/Copied/)).toBeInTheDocument();
  });
});
