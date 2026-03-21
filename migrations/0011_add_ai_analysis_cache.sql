-- AI analysis cache table for post/weekly/member summaries
CREATE TABLE IF NOT EXISTS aiAnalysisCache (
  id TEXT PRIMARY KEY,
  cacheKey TEXT NOT NULL UNIQUE,
  cacheType TEXT NOT NULL,
  targetId TEXT NOT NULL,
  inputHash TEXT NOT NULL,
  promptVersion TEXT NOT NULL,
  resultText TEXT NOT NULL,
  model TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aiAnalysisCache_lookup
  ON aiAnalysisCache(cacheType, targetId, inputHash, promptVersion, expiresAt);

CREATE INDEX IF NOT EXISTS idx_aiAnalysisCache_expiresAt
  ON aiAnalysisCache(expiresAt);
