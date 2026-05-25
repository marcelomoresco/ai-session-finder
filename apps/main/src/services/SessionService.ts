import type { Session, SessionId } from '@asf/domain';
import type { SessionListFilter, SessionReader, TurnReader } from '../persistence/SessionReader';
import type { SessionDetail } from './SessionDetail';

/**
 * Reads sessions and their turns for the detail view. Both readers are injected
 * (in practice the same SQLiteRepository instance satisfies both ports).
 */
export class SessionService {
  constructor(
    private readonly reader: SessionReader,
    private readonly turnReader: TurnReader,
  ) {}

  async findById(id: SessionId): Promise<SessionDetail | null> {
    const session = await this.reader.findById(id);
    if (!session) {
      return null;
    }
    const turns = await this.turnReader.listBySession(id);
    return { session, turns };
  }

  async list(filter: SessionListFilter): Promise<ReadonlyArray<Session>> {
    return this.reader.list(filter);
  }
}
