import type { SessionId } from './Session';

export type TurnId = string & { readonly __brand: 'TurnId' };

export type TurnRole = 'user' | 'assistant' | 'system' | 'tool';

export type FileOperation = 'read' | 'write' | 'edit';

export interface ToolCall {
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: string | null;
}

export interface FileTouched {
  readonly path: string;
  readonly operation: FileOperation;
}

export interface Turn {
  readonly id: TurnId;
  readonly sessionId: SessionId;
  readonly index: number;
  readonly role: TurnRole;
  readonly contentText: string;
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly filesTouched: ReadonlyArray<FileTouched>;
  readonly timestamp: Date;
}

export const TurnId = {
  from(value: string): TurnId {
    if (value.length === 0) {
      throw new Error('TurnId cannot be empty');
    }
    return value as TurnId;
  },
};
