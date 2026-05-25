import type { Session, Turn } from '@asf/domain';

/** A session together with its turns, ordered by index. */
export interface SessionDetail {
  readonly session: Session;
  readonly turns: ReadonlyArray<Turn>;
}
