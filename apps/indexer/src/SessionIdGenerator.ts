import { createHash } from 'node:crypto';
import { SessionId, type Tool } from '@asf/domain';

/**
 * Derives a stable SessionId from a session's tool + source id, so the same
 * source session always maps to the same row (enabling incremental upserts).
 * The 32-hex-char truncation of SHA-256 is collision-safe for this scale.
 */
export class SessionIdGenerator {
  static generate(tool: Tool, sourceId: string): SessionId {
    const hash = createHash('sha256').update(`${tool}:${sourceId}`).digest('hex').slice(0, 32);
    return SessionId.from(hash);
  }
}
