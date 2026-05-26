/** Read/maintenance side of the index, kept separate from the worker-facing IndexerService. */
export interface IndexAdminStore {
  countAll(): Promise<number>;
  lastIndexedAt(): Promise<Date | null>;
  clearAll(): Promise<void>;
}

export interface IndexStats {
  readonly indexed: number;
  readonly lastSync: Date | null;
}

/** Exposes index statistics and a "clear everything" maintenance action. */
export class IndexAdminService {
  constructor(private readonly store: IndexAdminStore) {}

  async stats(): Promise<IndexStats> {
    const [indexed, lastSync] = await Promise.all([
      this.store.countAll(),
      this.store.lastIndexedAt(),
    ]);
    return { indexed, lastSync };
  }

  clear(): Promise<void> {
    return this.store.clearAll();
  }
}
