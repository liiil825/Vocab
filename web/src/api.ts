const API = import.meta.env.VITE_API_URL || "http://localhost:3099/api";

export type WordSummary = {
  word: string;
  meaning: string;
  level: number;
  next_review: string;
  error_count: number;
}

export type WordDetail = WordSummary & {
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  interval_minutes: number;
  review_count: number;
  history: { date: string; result: string }[];
}

export type Status = {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}

export type ReviewResponse = {
  words: WordDetail[];
  count: number;
  streak: number;
  last_review_date: string | null;
}

export type FeedbackItem = {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
}

export type FeedbackResult = {
  success: boolean;
  results: { word: string; old_level: number; new_level: number; next_review: string; interval_minutes: number }[];
  summary: { passed: number; failed: number; fuzzy: number };
  updated_streak: number;
  message: string;
}

export const getStatus = () => fetch(`${API}/status`).then(r => r.json());
export const getReview = () => fetch(`${API}/review`).then(r => r.json());
export const getNextReview = () => fetch(`${API}/review/next`).then(r => r.json());
export const getWords = (filter?: string) => fetch(`${API}/words${filter ? `?filter=${filter}` : ''}`).then(r => r.json());
export const getWordDetail = (word: string) => fetch(`${API}/words/${encodeURIComponent(word)}`).then(r => r.json());
export const postFeedback = (feedbacks: FeedbackItem[]) => fetch(`${API}/review/feedback`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ feedbacks })
}).then(r => r.json());
export const postWord = (word: Omit<WordDetail, 'level' | 'next_review' | 'interval_minutes' | 'error_count' | 'review_count' | 'history' | 'added'>) => fetch(`${API}/words`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(word)
}).then(r => r.json());
export const deleteWord = (word: string) => fetch(`${API}/words/${encodeURIComponent(word)}`, { method: "DELETE" }).then(r => r.json());
export const updateWord = (word: string, updates: { meaning?: string; phonetic?: string; pos?: string; example?: string; example_cn?: string; etymology?: string }) => fetch(`${API}/words/${encodeURIComponent(word)}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(updates)
}).then(r => r.json());

export type EnrichData = {
  word: string;
  prototype: string;
  variant: VariantEntry[];
  etymology: string;
}

export type VariantEntry = {
  form: string;
  value: string;
}

export const getWordEnrich = (word: string): Promise<EnrichData> =>
  fetch(`${API}/words/${encodeURIComponent(word)}/enrich`).then(r => r.json());
