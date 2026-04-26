-- Apply this migration to the dedicated board D1 database

CREATE TABLE IF NOT EXISTS boardThreads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  authorEmail TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  isClosed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS boardComments (
  threadId TEXT NOT NULL,
  commentId TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  authorEmail TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (threadId) REFERENCES boardThreads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_boardThreads_updatedAt ON boardThreads(updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_boardComments_thread_createdAt ON boardComments(threadId, createdAt ASC);
