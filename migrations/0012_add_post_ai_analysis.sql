-- Store per-post AI analysis so each reply keeps a 1:1 analysis record
ALTER TABLE posts ADD COLUMN IF NOT EXISTS aiAnalysis TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS aiAnalysisUpdatedAt INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS isClosed BOOLEAN DEFAULT 0;

-- Create indexes for better query performance on analysis retrieval
CREATE INDEX IF NOT EXISTS idx_posts_analysis_lookup ON posts(id, aiAnalysis) WHERE aiAnalysis != '';
CREATE INDEX IF NOT EXISTS idx_posts_closed_status ON posts(isClosed, parentPostId);
