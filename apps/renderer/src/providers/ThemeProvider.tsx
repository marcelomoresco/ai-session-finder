import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} });

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(systemTheme);

  // Follow OS theme changes.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const handler = (event: MediaQueryListEvent): void => setTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // Reflect the theme on <html> for Tailwind's `dark:` variants.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  const toggle = (): void => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
