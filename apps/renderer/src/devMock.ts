import type { ResumeCommand, SearchResult, SessionDetail } from './lib/types';

// Sample data for viewing the launcher in a plain browser (no Electron/preload).
// Installed only in dev when window.trpc is absent — see main.tsx.

const HOUR = 3_600_000;
const DAY = 86_400_000;

const SAMPLE_RESULTS: SearchResult[] = [
  {
    sessionId: 'demo-1',
    turnId: 'demo-1:1',
    snippet: 'fix the race condition in the scheduler queue so two workers cannot claim the same job',
    projectName: 'scheduler',
    tool: 'claude-code',
    lastActivityAt: new Date(Date.now() - HOUR),
    score: 1,
  },
  {
    sessionId: 'demo-2',
    turnId: 'demo-2:0',
    snippet: 'add retry with exponential backoff to the HTTP client',
    projectName: 'api-client',
    tool: 'codex-cli',
    lastActivityAt: new Date(Date.now() - 2 * DAY),
    score: 0.82,
  },
  {
    sessionId: 'demo-3',
    turnId: 'demo-3:0',
    snippet: 'refactor the auth middleware to return a Result instead of throwing',
    projectName: 'web-app',
    tool: 'cursor',
    lastActivityAt: new Date(Date.now() - 30 * 60_000),
    score: 0.64,
  },
];

const SAMPLE_DETAIL: SessionDetail = {
  session: {
    id: 'demo-1',
    tool: 'claude-code',
    sourceId: 'abc123',
    projectPath: '/Users/you/scheduler',
    projectName: 'scheduler',
    gitBranch: 'main',
    startedAt: new Date(Date.now() - 2 * HOUR),
    lastActivityAt: new Date(Date.now() - HOUR),
    turnCount: 2,
    model: 'claude-opus',
    tokenUsage: { inputTokens: 1200, outputTokens: 3400, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: '/Users/you/.claude/projects/scheduler/session.jsonl',
    fileMtime: Date.now(),
    indexedAt: new Date(),
  },
  turns: [
    {
      id: 'demo-1:0',
      sessionId: 'demo-1',
      index: 0,
      role: 'user',
      contentText: 'There is a race condition in the scheduler queue — two workers can pick the same job.',
      toolCalls: [],
      filesTouched: [],
      timestamp: new Date(Date.now() - 2 * HOUR),
    },
    {
      id: 'demo-1:1',
      sessionId: 'demo-1',
      index: 1,
      role: 'assistant',
      contentText:
        'Claim the job atomically so only one worker wins:\n\n```ts\nconst claimed = db\n  .prepare("UPDATE jobs SET worker = ? WHERE id = ? AND worker IS NULL")\n  .run(workerId, jobId);\nif (claimed.changes === 0) return; // another worker already claimed it\n```\n\nThe conditional UPDATE makes the claim atomic.',
      toolCalls: [],
      filesTouched: [],
      timestamp: new Date(Date.now() - HOUR),
    },
  ],
};

const RESUME: ResumeCommand = {
  command: 'claude --resume abc123',
  workingDirectory: '/Users/you/scheduler',
  hint: 'Run in terminal at the project directory',
};

export function installDevTrpcMock(): void {
  let settings: Record<string, unknown> = {
    launcherShortcut: 'CommandOrControl+Shift+Space',
    theme: 'system',
    semanticSearchEnabled: true,
    autoStartOnLogin: false,
    onboardingCompleted: true,
    enabledSources: ['claude-code', 'codex-cli', 'cursor'],
    encryptDatabase: false,
  };

  const invoke = (path: string, _type: 'query' | 'mutation', input: unknown): Promise<unknown> => {
    if (path === 'search.query') return Promise.resolve(SAMPLE_RESULTS);
    if (path === 'search.browseActive') {
      const tools = (input as { filters?: { tools?: string[] } }).filters?.tools;
      return Promise.resolve(
        tools ? SAMPLE_RESULTS.filter((r) => tools.includes(r.tool)) : SAMPLE_RESULTS,
      );
    }
    if (path === 'session.get') return Promise.resolve(SAMPLE_DETAIL);
    if (path === 'resume.buildCommand') return Promise.resolve(RESUME);
    if (path === 'resume.run') return Promise.resolve(true); // browser can't launch; demo only
    if (path === 'settings.get') return Promise.resolve(settings);
    if (path === 'settings.update') {
      settings = { ...settings, ...(input as Record<string, unknown>) };
      return Promise.resolve(settings);
    }
    if (path === 'permissions.fullDiskAccess') return Promise.resolve(true);
    if (path === 'indexer.stats')
      return Promise.resolve({ indexed: SAMPLE_RESULTS.length, lastSync: new Date(Date.now() - HOUR) });
    if (path === 'system.info') return Promise.resolve({ version: '0.0.0-dev', platform: 'darwin' });
    if (path === 'indexer.fullReindex' || path === 'indexer.clearIndex')
      return Promise.resolve(undefined);
    return Promise.resolve(null);
  };
  Object.defineProperty(window, 'trpc', { configurable: true, value: { invoke } });
  // eslint-disable-next-line no-console
  console.info('[dev] window.trpc mock installed (sample data)');
}
