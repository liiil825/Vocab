/**
 * Migration script: JSON to SQLite
 * Run: bun run scripts/migrate-json-to-sqlite.ts
 */

import { Database } from "bun:sqlite";
import * as fs from "fs";

const JSON_PATH = `${process.env.HOME}/.vocab-trainer/words.json.bak`;
const DB_PATH = `${process.env.HOME}/.vocab-trainer/words.db`;

interface JsonWord {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  level: number;
  next_review: string;
  interval_days: number;
  error_count: number;
  review_count: number;
  history: { date: string; result: string }[];
}

interface JsonData {
  version: number;
  streak: number;
  last_review_date: string;
  total_reviews: number;
  words: JsonWord[];
}

function migrate() {
  console.log("Starting migration from JSON to SQLite...");
  console.log(`JSON file: ${JSON_PATH}`);
  console.log(`DB file: ${DB_PATH}`);

  // Read JSON
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`JSON file not found: ${JSON_PATH}`);
    process.exit(1);
  }

  const jsonData: JsonData = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`Found ${jsonData.words.length} words in JSON`);

  // Backup existing DB
  if (fs.existsSync(DB_PATH)) {
    const backupPath = `${DB_PATH}.pre-migration-${Date.now()}`;
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Backed up existing DB to: ${backupPath}`);
  }

  // Create new DB
  const db = new Database(DB_PATH);

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

  // Insert stats
  db.query(`
    INSERT OR REPLACE INTO stats (id, version, streak, last_review_date, total_reviews)
    VALUES (1, ?, ?, ?, ?)
  `).run(jsonData.version, jsonData.streak, jsonData.last_review_date, jsonData.total_reviews);

  console.log(`Stats: streak=${jsonData.streak}, total_reviews=${jsonData.total_reviews}`);

  // Insert words
  const insertStmt = db.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;

  for (const word of jsonData.words) {
    try {
      insertStmt.run(
        word.word,
        word.word.toLowerCase(),
        word.meaning || "",
        word.phonetic || "",
        word.pos || "",
        word.example || "",
        word.example_cn || "",
        word.source || "user",
        word.added,
        word.level || 0,
        word.next_review,
        word.interval_days || 1,
        word.error_count || 0,
        word.review_count || 0,
        JSON.stringify(word.history || [])
      );
      inserted++;
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed")) {
        console.log(`Skipped duplicate word: ${word.word}`);
        skipped++;
      } else {
        console.error(`Error inserting word ${word.word}:`, e.message);
      }
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Total in JSON: ${jsonData.words.length}`);

  db.close();
}

migrate();
