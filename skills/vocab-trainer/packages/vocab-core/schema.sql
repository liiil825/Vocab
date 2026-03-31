-- Vocab-Trainer SQLite Schema v2
-- 艾宾浩斯间隔: 20分钟, 1小时, 4小时, 12小时, 1天, 2天, 7天, 15天, 30天

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  word_lower TEXT NOT NULL,
  meaning TEXT DEFAULT '',
  phonetic TEXT DEFAULT '',
  pos TEXT DEFAULT '',
  example TEXT DEFAULT '',
  example_cn TEXT DEFAULT '',
  source TEXT DEFAULT 'user',
  added TEXT NOT NULL,
  level INTEGER DEFAULT 0,              -- 0-9
  next_review TEXT NOT NULL,            -- ISO8601 datetime
  interval_minutes INTEGER DEFAULT 20,  -- 间隔分钟数 (默认20分钟)
  error_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  history TEXT DEFAULT '[]',
  prototype TEXT DEFAULT '[]',
  variant TEXT DEFAULT '[]',
  etymology TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version INTEGER DEFAULT 2,            -- schema version 2
  streak INTEGER DEFAULT 0,
  last_review_date TEXT,               -- ISO8601 datetime
  total_reviews INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
