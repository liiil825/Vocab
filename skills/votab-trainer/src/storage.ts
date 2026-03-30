import { Database } from "bun:sqlite";
import { VocabData, Word, ReviewRecord } from "./types.js";

function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.db`;
}

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;

  const dbPath = getDataPath();
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));

  // Ensure directory exists
  if (dir) {
    try {
      require('fs').mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  db = new Database(dbPath);

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
      interval_days INTEGER DEFAULT 1,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
    CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
    CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
  `);

  // Ensure stats row exists
  const stats = db.query("SELECT * FROM stats WHERE id = 1").get();
  if (!stats) {
    db.query("INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 1, 0, 0)").run();
  }

  return db;
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
    interval_days: row.interval_days,
    error_count: row.error_count,
    review_count: row.review_count,
    history: JSON.parse(row.history || "[]") as ReviewRecord[]
  };
}

export function loadData(): VocabData {
  const database = getDb();

  const statsRow = database.query("SELECT * FROM stats WHERE id = 1").get() as any;
  const wordsRows = database.query("SELECT * FROM words").all() as any[];

  return {
    version: statsRow?.version || 1,
    streak: statsRow?.streak || 0,
    last_review_date: statsRow?.last_review_date || null,
    total_reviews: statsRow?.total_reviews || 0,
    words: wordsRows.map(rowToWord)
  };
}

export function saveData(data: VocabData): void {
  const database = getDb();

  database.query(`
    INSERT OR REPLACE INTO stats (id, version, streak, last_review_date, total_reviews)
    VALUES (1, ?, ?, ?, ?)
  `).run(data.version, data.streak, data.last_review_date, data.total_reviews);
}

export function addWord(word: Word): void {
  const database = getDb();

  database.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    word.interval_days,
    word.error_count,
    word.review_count,
    JSON.stringify(word.history)
  );
}

export function getWord(word: string): Word | undefined {
  const database = getDb();
  const row = database.query(
    "SELECT * FROM words WHERE word_lower = ?"
  ).get(word.toLowerCase()) as any;

  return row ? rowToWord(row) : undefined;
}

export function updateWord(word: string, updates: Partial<Word>): Word | undefined {
  const database = getDb();
  const existing = getWord(word);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  const wordLower = word.toLowerCase();

  database.query(`
    UPDATE words SET
      word = ?, word_lower = ?, meaning = ?, phonetic = ?, pos = ?,
      example = ?, example_cn = ?, source = ?, added = ?, level = ?,
      next_review = ?, interval_days = ?, error_count = ?, review_count = ?, history = ?
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
    updated.interval_days,
    updated.error_count,
    updated.review_count,
    JSON.stringify(updated.history),
    wordLower
  );

  return updated;
}

export function removeWord(word: string): boolean {
  const database = getDb();
  const result = database.query(
    "DELETE FROM words WHERE word_lower = ?"
  ).run(word.toLowerCase());

  return result.changes > 0;
}

export function getWordsByFilter(filter?: string): Word[] {
  const database = getDb();
  const today = new Date().toISOString().split("T")[0];

  let rows: any[];
  switch (filter) {
    case "new":
      rows = database.query("SELECT * FROM words WHERE level = 0").all();
      break;
    case "learning":
      rows = database.query("SELECT * FROM words WHERE level >= 1 AND level <= 3").all();
      break;
    case "hard":
      rows = database.query("SELECT * FROM words WHERE level <= 1 AND error_count >= 1").all();
      break;
    case "mastered":
      rows = database.query("SELECT * FROM words WHERE level = 5").all();
      break;
    case "today":
      rows = database.query("SELECT * FROM words WHERE next_review <= ?").all(today);
      break;
    default:
      rows = database.query("SELECT * FROM words").all();
  }

  return rows.map(rowToWord);
}

export function getDueWords(): Word[] {
  const database = getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = database.query(
    "SELECT * FROM words WHERE next_review <= ?"
  ).all(today);

  return rows.map(rowToWord);
}

export function updateStats(streak: number, lastReviewDate: string): void {
  const database = getDb();
  database.query(`
    UPDATE stats SET streak = ?, last_review_date = ?, total_reviews = total_reviews + 1
    WHERE id = 1
  `).run(streak, lastReviewDate);
}
