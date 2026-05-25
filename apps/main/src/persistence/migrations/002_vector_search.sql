-- 002_vector_search.sql
-- Requires the sqlite-vec extension to be loaded on the connection (see
-- extensions/loadSqliteVec.ts). createDatabase only applies this migration when
-- the extension loaded successfully, so the vec0 module is guaranteed present.
--
-- vec0 backs k-NN semantic search over 768-dim embeddings
-- (nomic-embed-text-v1.5). turn_id mirrors turns.id; rows are kept in sync by
-- the indexing Pipeline, not by triggers (vec0 cannot be a trigger target).
CREATE VIRTUAL TABLE vec_turns USING vec0(
  turn_id TEXT PRIMARY KEY,
  embedding FLOAT[768]
);
