import { z } from 'zod';

// CONFIRMED in the sprint spec (Section 9.3):
//   - `cursorDiskKV` rows keyed `composerData:<composerId>` and
//     `bubbleId:<composerId>:<bubbleId>` hold JSON payloads.
//   - bubbles are ordered by a numeric `createdAt`.
//
// NOT CONFIRMED (educated guesses, flagged for tuning against a real,
// anonymized .vscdb — see Rule 2/5): every field below except `createdAt`.
// Schemas are lenient (all-optional, unknown keys stripped) so parsing never
// throws on shape drift across Cursor versions. Mirrors the CodexJsonlEvent
// approach. Tune field names once a real fixture is available.

export const CursorBubbleSchema = z.object({
  /** Confirmed: numeric sort key for bubbles within a composer. */
  createdAt: z.number().optional(),
  /** Guess: 1 = user, 2 = assistant (Cursor stores role as an enum int). */
  type: z.number().optional(),
  /** Guess: explicit role string, when present, wins over `type`. */
  role: z.string().optional(),
  /** Guess: plain-text message body. */
  text: z.string().optional(),
  /** Guess: rich-text fallback when `text` is absent. */
  richText: z.string().optional(),
});

export const CursorComposerMetaSchema = z.object({
  composerId: z.string().optional(),
  /** Guess: human-readable session title. */
  name: z.string().optional(),
  /** Guess: session creation / last-update epoch millis. */
  createdAt: z.number().optional(),
  lastUpdatedAt: z.number().optional(),
  /** Guess: model id, if Cursor records one. */
  model: z.string().optional(),
});

export type CursorBubble = z.infer<typeof CursorBubbleSchema>;
export type CursorComposerMeta = z.infer<typeof CursorComposerMetaSchema>;

/** One Cursor composer (session) with its ordered bubbles, as read from vscdb. */
export interface CursorComposerSession {
  readonly composerId: string;
  readonly meta: CursorComposerMeta;
  readonly bubbles: ReadonlyArray<CursorBubble>;
}
