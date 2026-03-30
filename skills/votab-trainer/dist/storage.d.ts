import { VocabData, Word } from "./types.js";
/**
 * Close the cached database connection.
 * This is primarily used for testing to allow resetTestData() to
 * recreate the database file without stale connection issues.
 */
export declare function closeDb(): void;
export declare function loadData(): VocabData;
export declare function saveData(data: VocabData): void;
export declare function addWord(word: Word): void;
export declare function getWord(word: string): Word | undefined;
export declare function updateWord(word: string, updates: Partial<Word>): Word | undefined;
export declare function removeWord(word: string): boolean;
export declare function getWordsByFilter(filter?: string): Word[];
export declare function getDueWords(): Word[];
export declare function updateStats(streak: number, lastReviewDate: string): void;
export declare function updateWordEnrich(word: string, enrich: {
    prototype: string;
    variant: string;
    etymology: string;
}): void;
