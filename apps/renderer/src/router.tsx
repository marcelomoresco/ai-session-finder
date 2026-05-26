import { createHashRouter, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Launcher } from './components/Launcher';
import { PreviewPane } from './components/PreviewPane';
import { SettingsPage } from './pages/SettingsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { trpc } from './lib/trpc';
import type { SearchResult } from './lib/types';

function LauncherScreen() {
  const navigate = useNavigate();
  const resume = trpc.resume.run.useMutation();
  const onOpen = (result: SearchResult): void => {
    // Reopen the session in its own tool at its original directory (`claude
    // --resume` etc.). The launcher hides on blur once the terminal takes focus.
    resume.mutate({ sessionId: result.sessionId });
  };
  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent px-4 pt-[8vh]">
      <Launcher onOpen={onOpen} onSettings={() => void navigate('/settings')} />
    </div>
  );
}

function SessionScreen() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  if (!id) return null;
  const focusedTurnId = params.get('turn');
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100">
      <PreviewPane sessionId={id} {...(focusedTurnId ? { focusedTurnId } : {})} />
    </div>
  );
}

function SettingsScreen() {
  // Opaque, scrollable backdrop — the launcher window is transparent, so the
  // settings page needs its own solid background to be readable.
  return (
    <div className="h-screen overflow-y-auto bg-[#1c1c20]">
      <SettingsPage />
    </div>
  );
}

function OnboardingScreen() {
  const navigate = useNavigate();
  const update = trpc.settings.update.useMutation();
  return (
    <OnboardingPage
      onComplete={() => {
        update.mutate({ onboardingCompleted: true });
        void navigate('/');
      }}
    />
  );
}

export const router = createHashRouter([
  { path: '/', element: <LauncherScreen /> },
  { path: '/sessions/:id', element: <SessionScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '/onboarding', element: <OnboardingScreen /> },
]);
