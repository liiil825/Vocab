import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { VocabData, Word } from "./types.js";

function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.json`;
}

function ensureDir(): void {
  const dir = dirname(getDataPath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getDefaultData(): VocabData {
  return {
    version: 1,
    streak: 0,
    last_review_date: null,
    total_reviews: 0,
    words: []
  };
}

export function loadData(): VocabData {
  ensureDir();
  if (!existsSync(getDataPath())) {
    const data = getDefaultData();
    saveData(data);
    return data;
  }
  const content = readFileSync(getDataPath(), "utf-8");
  return JSON.parse(content) as VocabData;
}

export function saveData(data: VocabData): void {
  ensureDir();
  writeFileSync(getDataPath(), JSON.stringify(data, null, 2), "utf-8");
}

export function addWord(word: Word): void {
  const data = loadData();
  data.words.push(word);
  saveData(data);
}

export function getWord(word: string): Word | undefined {
  const data = loadData();
  return data.words.find(w => w.word.toLowerCase() === word.toLowerCase());
}

export function updateWord(word: string, updates: Partial<Word>): Word | undefined {
  const data = loadData();
  const idx = data.words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
  if (idx === -1) return undefined;

  data.words[idx] = { ...data.words[idx], ...updates };
  saveData(data);
  return data.words[idx];
}

export function removeWord(word: string): boolean {
  const data = loadData();
  const idx = data.words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
  if (idx === -1) return false;

  data.words.splice(idx, 1);
  saveData(data);
  return true;
}

export function getWordsByFilter(filter?: string): Word[] {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];

  switch (filter) {
    case "new":
      return data.words.filter(w => w.level === 0);
    case "learning":
      return data.words.filter(w => w.level >= 1 && w.level <= 3);
    case "hard":
      return data.words.filter(w => w.level <= 1 && w.error_count >= 1);
    case "mastered":
      return data.words.filter(w => w.level === 5);
    case "today":
      return data.words.filter(w => w.next_review <= today);
    default:
      return data.words;
  }
}

export function getDueWords(): Word[] {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];
  return data.words.filter(w => w.next_review <= today);
}

export function updateStats(streak: number, lastReviewDate: string): void {
  const data = loadData();
  data.streak = streak;
  data.last_review_date = lastReviewDate;
  data.total_reviews += 1;
  saveData(data);
}
