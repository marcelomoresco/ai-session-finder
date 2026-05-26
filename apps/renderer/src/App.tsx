import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { ThemeProvider } from './providers/ThemeProvider';
import { OnboardingGate } from './components/OnboardingGate';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <AppProviders>
        <OnboardingGate>
          <RouterProvider router={router} />
        </OnboardingGate>
      </AppProviders>
    </ThemeProvider>
  );
}
