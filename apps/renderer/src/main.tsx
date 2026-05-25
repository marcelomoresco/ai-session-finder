import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element #root not found');
}

async function bootstrap(): Promise<void> {
  // In a plain browser (no Electron preload), install sample data so the UI is
  // viewable. Dynamically imported so it's excluded from production builds.
  if (import.meta.env.DEV && !('trpc' in window)) {
    const { installDevTrpcMock } = await import('./devMock');
    installDevTrpcMock();
  }

  createRoot(rootElement!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
