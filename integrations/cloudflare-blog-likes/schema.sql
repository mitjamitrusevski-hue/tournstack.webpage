-- Atomic aggregate changes; expiring anonymous control tokens never remove votes.
CREATE TABLE IF NOT EXISTS article_counts (
  article_id TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0)
);
CREATE TABLE IF NOT EXISTS article_votes (
  article_id TEXT NOT NULL REFERENCES article_counts(article_id),
  token_hash TEXT NOT NULL,
  liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (article_id, token_hash)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS article_votes_expiry ON article_votes(expires_at);
CREATE TRIGGER IF NOT EXISTS vote_insert AFTER INSERT ON article_votes
BEGIN
  UPDATE article_counts SET likes = likes + NEW.liked WHERE article_id = NEW.article_id;
END;
CREATE TRIGGER IF NOT EXISTS vote_update AFTER UPDATE OF liked ON article_votes
BEGIN
  UPDATE article_counts SET likes = likes + NEW.liked - OLD.liked WHERE article_id = NEW.article_id;
END;
-- Only explicitly approved article identities belong in this register.
INSERT OR IGNORE INTO article_counts(article_id) VALUES ('TS-BLOG-0001');
