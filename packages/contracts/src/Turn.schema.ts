import { z } from 'zod';

export const TurnRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export const FileOperationSchema = z.enum(['read', 'write', 'edit']);

export const ToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  result: z.string().nullable(),
});

export const FileTouchedSchema = z.object({
  path: z.string(),
  operation: FileOperationSchema,
});

export const TurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  index: z.number().int().min(0),
  role: TurnRoleSchema,
  contentText: z.string(),
  toolCalls: z.array(ToolCallSchema),
  filesTouched: z.array(FileTouchedSchema),
  timestamp: z.date(),
});

export type TurnInput = z.input<typeof TurnSchema>;
export type TurnParsed = z.output<typeof TurnSchema>;
