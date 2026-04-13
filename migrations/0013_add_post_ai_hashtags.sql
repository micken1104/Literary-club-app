-- Store AI-selected hashtags for each post
ALTER TABLE posts ADD COLUMN IF NOT EXISTS aiHashtagsJson TEXT DEFAULT '[]';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS aiHashtagsUpdatedAt INTEGER;

-- Index for scheduled refresh lookups
CREATE INDEX IF NOT EXISTS idx_posts_aiHashtagsUpdatedAt
  ON posts(aiHashtagsUpdatedAt, updatedAt);