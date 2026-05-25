import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeProvider';

function setSystemDark(dark: boolean): void {
  window.matchMedia = (query: string) => ({
    matches: dark,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      theme: {theme}
    </button>
  );
}

describe('ThemeProvider', () => {
  it('adopts the system dark preference and sets the dark class', () => {
    setSystemDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('theme: dark')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('toggles to light and removes the dark class', async () => {
    setSystemDark(true);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('theme: light')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
