import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('toggles a tool on, then off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<FilterBar filters={{}} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Claude' }));
    expect(onChange).toHaveBeenCalledWith({ tools: ['claude-code'] });

    rerender(<FilterBar filters={{ tools: ['claude-code'] }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Claude' }));
    expect(onChange).toHaveBeenCalledWith({ tools: undefined });
  });

  it('switches provider to a single tool, replacing the previous selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterBar filters={{ tools: ['claude-code'] }} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Codex' }));
    expect(onChange).toHaveBeenCalledWith({ tools: ['codex-cli'] });
  });

  it('reflects selection with aria-pressed', () => {
    render(<FilterBar filters={{ tools: ['cursor'] }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cursor' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Claude' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the active-filter count and resets everything', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterBar filters={{ tools: ['cursor'], projectPath: '/p' }} onChange={onChange} />);

    expect(screen.getByText('2 active')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
