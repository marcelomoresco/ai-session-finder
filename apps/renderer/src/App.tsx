import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { ThemeProvider } from './providers/ThemeProvider';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ThemeProvider>
  );
}
