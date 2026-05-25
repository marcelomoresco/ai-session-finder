# Persistence usage

Open the database (the caller provides the data directory — in the Electron main
process that is `app.getPath('userData')`), then use `SQLiteRepository`, which
implements the reader, writer, and search interfaces.

```ts
import { app } from 'electron';
import { createDatabase } from './persistence/createDatabase';
import { SQLiteRepository } from './persistence/SQLiteRepository';
import { SessionId } from '@asf/domain';

const handle = createDatabase(app.getPath('userData'));
const repo = new SQLiteRepository(handle.db);

// Write a session and its turns atomically.
await repo.upsert(session, turns);

// Read it back (ids come back branded).
const found = await repo.findById(SessionId.from('abc123'));

// Full-text search, ranked by relevance.
const hits = await repo.search({
  text: 'race condition',
  mode: 'quick',
  filters: { tools: ['claude-code'] },
  limit: 30,
});

// On shutdown.
handle.close();
```
