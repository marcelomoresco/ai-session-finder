import type { JSX } from 'react';

export function App(): JSX.Element {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="rounded-2xl bg-neutral-900/90 px-10 py-7 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <h1 className="text-xl font-semibold text-white">Hello AI Session Finder</h1>
        <p className="mt-1 text-sm text-neutral-400">Sprint 00 — Electron shell</p>
      </div>
    </main>
  );
}
