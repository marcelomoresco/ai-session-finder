import { createHashRouter, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Launcher } from './components/Launcher';
import { PreviewPane } from './components/PreviewPane';
import type { SearchResult } from './lib/types';

function LauncherScreen() {
  const navigate = useNavigate();
  const onOpen = (result: SearchResult): void => {
    void navigate(`/sessions/${result.sessionId}?turn=${result.turnId}`);
  };
  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent px-4 pt-[12vh]">
      <Launcher onOpen={onOpen} />
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
  return <div className="p-8 text-sm text-zinc-400">Settings — coming soon.</div>;
}

export const router = createHashRouter([
  { path: '/', element: <LauncherScreen /> },
  { path: '/sessions/:id', element: <SessionScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
]);
