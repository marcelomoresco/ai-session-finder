import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { queryClient } from './lib/queryClient';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    queryClient.clear();
    window.location.hash = '#/';
    Object.defineProperty(window, 'trpc', {
      configurable: true,
      value: { invoke: vi.fn().mockResolvedValue([]) },
    });
  });

  it('renders the launcher at the root route', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/search across all/i)).toBeInTheDocument();
  });
});
