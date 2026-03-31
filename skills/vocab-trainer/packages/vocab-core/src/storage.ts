import { Database } from "bun:sqlite";
import { VocabData, Word, ReviewRecord, EnrichResult, EnrichItem } from "./types.js";

function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.db`;
}

function ensureDir(dbPath: string): void {
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
  if (dir) {
    try {
      require('fs').mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }
}

function rowToWord(row: any): Word {
  return {
    word: row.word,
    meaning: row.meaning || "",
    phonetic: row.phonetic || "",
    pos: row.pos || "",
    example: row.example || "",
    example_cn: row.example_cn || "",
    source: row.source || "user",
    added: row.added,
    level: row.level,
    next_review: row.next_review,
    interval_minutes: row.interval_minutes,
    error_count: row.error_count,
    review_count: row.review_count,
    history: JSON.parse(row.history || "[]") as ReviewRecord[],
    prototype: JSON.parse(row.prototype || "[]") as EnrichItem[],
    variant: JSON.parse(row.variant || "[]") as EnrichItem[],
    etymology: JSON.parse(row.etymology || "[]") as EnrichItem[]
  };
}

/**
 * Storage connection interface
 */
export interface StorageConnection {
  loadData(): VocabData;
  saveData(data: VocabData): void;
  addWord(word: Word): void;
  getWord(word: string): Word | undefined;
  updateWord(word: string, updates: Partial<Word>): Word | undefined;
  removeWord(word: string): boolean;
  getWordsByFilter(filter?: string): Word[];
  getDueWords(): Word[];
  updateStats(streak: number, lastReviewDate: string): void;
  updateWordEnrich(word: string, enrich: EnrichResult): void;
  close(): void;
}

/**
 * Create a storage connection for the given database path.
 * Each call creates a new connection - no singleton caching.
 */
export function createStorage(config: { dbPath?: string } = {}): StorageConnection {
  const dbPath = config.dbPath || getDataPath();
  ensureDir(dbPath);

  const db = new Database(dbPath);

  // Initialize schema
  db.exec(`
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
      level INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      interval_minutes INTEGER DEFAULT 20,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      prototype TEXT DEFAULT '[]',
      variant TEXT DEFAULT '[]',
      etymology TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 2,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
    CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
    CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
  `);

  // Migrate existing rows: add new columns if not exist (for existing DBs)
  try {
    db.exec("ALTER TABLE words ADD COLUMN prototype TEXT DEFAULT '[]'");
    db.exec("ALTER TABLE words ADD COLUMN variant TEXT DEFAULT '[]'");
    db.exec("ALTER TABLE words ADD COLUMN etymology TEXT DEFAULT '[]'");
  } catch {
    // Columns may already exist
  }

  // Migrate: interval_days -> interval_minutes if needed
  try {
    const cols = db.query("PRAGMA table_info(words)").all() as any[];
    const hasIntervalDays = cols.some(c => c.name === 'interval_days');
    const hasIntervalMinutes = cols.some(c => c.name === 'interval_minutes');
    if (hasIntervalDays && !hasIntervalMinutes) {
      db.exec("ALTER TABLE words ADD COLUMN interval_minutes INTEGER");
      db.exec("UPDATE words SET interval_minutes = interval_days * 1440 WHERE interval_minutes IS NULL");
    }
  } catch {
    // Migration may have already been done
  }

  // Ensure stats row exists
  const stats = db.query("SELECT * FROM stats WHERE id = 1").get();
  if (!stats) {
    db.query("INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 2, 0, 0)").run();
  }

  return {
    loadData(): VocabData {
      const statsRow = db.query("SELECT * FROM stats WHERE id = 1").get() as any;
      const wordsRows = db.query("SELECT * FROM words").all() as any[];

      return {
        version: statsRow?.version || 1,
        streak: statsRow?.streak || 0,
        last_review_date: statsRow?.last_review_date || null,
        total_reviews: statsRow?.total_reviews || 0,
        words: wordsRows.map(rowToWord)
      };
    },

    saveData(data: VocabData): void {
      db.query(`
        INSERT OR REPLACE INTO stats (id, version, streak, last_review_date, total_reviews)
        VALUES (1, ?, ?, ?, ?)
      `).run(data.version, data.streak, data.last_review_date, data.total_reviews);
    },

    addWord(word: Word): void {
      db.query(`
        INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_minutes, error_count, review_count, history, prototype, variant, etymology)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        word.word,
        word.word.toLowerCase(),
        word.meaning,
        word.phonetic,
        word.pos,
        word.example,
        word.example_cn,
        word.source,
        word.added,
        word.level,
        word.next_review,
        word.interval_minutes,
        word.error_count,
        word.review_count,
        JSON.stringify(word.history),
        JSON.stringify(word.prototype),
        JSON.stringify(word.variant),
        JSON.stringify(word.etymology)
      );
    },

    getWord(word: string): Word | undefined {
      const row = db.query(
        "SELECT * FROM words WHERE word_lower = ?"
      ).get(word.toLowerCase()) as any;

      return row ? rowToWord(row) : undefined;
    },

    updateWord(word: string, updates: Partial<Word>): Word | undefined {
      const existing = this.getWord(word);
      if (!existing) return undefined;

      const updated = { ...existing, ...updates };
      const wordLower = word.toLowerCase();

      db.query(`
        UPDATE words SET
          word = ?, word_lower = ?, meaning = ?, phonetic = ?, pos = ?,
          example = ?, example_cn = ?, source = ?, added = ?, level = ?,
          next_review = ?, interval_minutes = ?, error_count = ?, review_count = ?, history = ?,
          prototype = ?, variant = ?, etymology = ?
        WHERE word_lower = ?
      `).run(
        updated.word,
        updated.word.toLowerCase(),
        updated.meaning,
        updated.phonetic,
        updated.pos,
        updated.example,
        updated.example_cn,
        updated.source,
        updated.added,
        updated.level,
        updated.next_review,
        updated.interval_minutes,
        updated.error_count,
        updated.review_count,
        JSON.stringify(updated.history),
        JSON.stringify(updated.prototype),
        JSON.stringify(updated.variant),
        JSON.stringify(updated.etymology),
        wordLower
      );

      return updated;
    },

    removeWord(word: string): boolean {
      const result = db.query(
        "DELETE FROM words WHERE word_lower = ?"
      ).run(word.toLowerCase());

      return result.changes > 0;
    },

    getWordsByFilter(filter?: string): Word[] {
      const now = new Date().toISOString();

      let rows: any[];
      switch (filter) {
        case "new":
          rows = db.query("SELECT * FROM words WHERE level = 0").all();
          break;
        case "learning":
          rows = db.query("SELECT * FROM words WHERE level >= 1 AND level <= 4").all();
          break;
        case "hard":
          rows = db.query("SELECT * FROM words WHERE level <= 2 AND error_count >= 1").all();
          break;
        case "mastered":
          rows = db.query("SELECT * FROM words WHERE level >= 8").all(); // 8-9 are mastered
          break;
        case "today":
          rows = db.query("SELECT * FROM words WHERE next_review <= ?").all(now);
          break;
        default:
          rows = db.query("SELECT * FROM words").all();
      }

      return rows.map(rowToWord);
    },

    getDueWords(): Word[] {
      const now = new Date().toISOString();
      const rows = db.query(
        "SELECT * FROM words WHERE next_review <= ?"
      ).all(now);

      return rows.map(rowToWord);
    },

    updateStats(streak: number, lastReviewDate: string): void {
      db.query(`
        UPDATE stats SET streak = ?, last_review_date = ?, total_reviews = total_reviews + 1
        WHERE id = 1
      `).run(streak, lastReviewDate);
    },

    updateWordEnrich(word: string, enrich: EnrichResult): void {
      db.query(`
        UPDATE words SET prototype = ?, variant = ?, etymology = ?
        WHERE word_lower = ?
      `).run(JSON.stringify(enrich.prototype), JSON.stringify(enrich.variant), JSON.stringify(enrich.etymology), word.toLowerCase());
    },

    close(): void {
      db.close();
    }
  };
}

/**
 * Create a storage connection from environment variables.
 * Uses VOCAB_DATA_PATH or ~/.vocab-trainer/words.db
 *
 * Note: For backward compatibility with tests, this caches the storage
 * instance. Use closeDb() to reset the cache.
 */
let cachedStorage: StorageConnection | null = null;
let cachedDbPath: string | null = null;

export function createStorageFromEnv(): StorageConnection {
  const dbPath = getDataPath();

  // Return cached instance if same path and still open
  if (cachedStorage && cachedDbPath === dbPath) {
    return cachedStorage;
  }

  // Close existing if path changed
  if (cachedStorage) {
    cachedStorage.close();
  }

  cachedStorage = createStorage({});
  cachedDbPath = dbPath;
  return cachedStorage;
}

/**
 * Close the cached storage instance (for test cleanup).
 * This resets the singleton cache so next createStorageFromEnv() creates fresh instance.
 */
export function closeDb(): void {
  if (cachedStorage) {
    cachedStorage.close();
    cachedStorage = null;
    cachedDbPath = null;
  }
}
