export type { SessionSource } from './sources/SessionSource';
export type { RawSession, RawTurn } from './sources/RawSession';
export { SourceRegistry, createDefaultRegistry } from './sources/SourceRegistry';
export { ClaudeCodeSource } from './sources/claude/ClaudeCodeSource';
export { CodexCliSource } from './sources/codex/CodexCliSource';
export { CursorSource } from './sources/cursor/CursorSource';

// ---- Sprint 03: indexing pipeline ----
export { Pipeline } from './Pipeline';
export type { PipelineDeps } from './Pipeline';
export type {
  SessionReaderPort,
  SessionWriterPort,
  VectorWriterPort,
  VectorRecord,
} from './ports';
export { TurnChunker } from './chunking/TurnChunker';
export type { Chunk, ChunkerOptions } from './chunking/TurnChunker';
export { estimateTokens, CHARS_PER_TOKEN } from './chunking/tokenize';
export type { Embedder } from './embedding/Embedder';
export { LocalEmbedder } from './embedding/LocalEmbedder';
export type {
  EmbeddingPipeline,
  EmbeddingTensor,
  PipelineFactory,
} from './embedding/LocalEmbedder';
export { NoopEmbedder } from './embedding/NoopEmbedder';
export { ConsoleLogger, NoopLogger } from './Logger';
export type { Logger } from './Logger';
export { SessionIdGenerator } from './SessionIdGenerator';
export { redactSecrets } from './security/redactSecrets';
export { FsWatcher } from './Watcher';
export type { WatcherEvents, WatcherOptions } from './Watcher';
