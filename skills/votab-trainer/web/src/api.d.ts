const API = "http://localhost:3099/api";

export interface WordSummary {
  word: string;
  meaning: string;
  level: number;
  next_review: string;
  error_count: number;
}

export interface WordDetail extends WordSummary {
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  interval_days: number;
  review_count: number;
  history: { date: string; result: string }[];
}

export interface Status {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}

export interface ReviewResponse {
  words: WordDetail[];
  count: number;
  streak: number;
  last_review_date: string | null;
}

export interface FeedbackItem {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
}

export interface FeedbackResult {
  success: boolean;
  results: { word: string; old_level: number; new_level: number; next_review: string; interval_days: number }[];
  summary: { passed: number; failed: number; fuzzy: number };
  updated_streak: number;
  message: string;
}

export const getStatus: () => Promise<Status>;
export const getReview: () => Promise<ReviewResponse>;
export const getWords: (filter?: string) => Promise<{ words: WordSummary[]; total: number }>;
export const getWordDetail: (word: string) => Promise<WordDetail>;
export const postFeedback: (feedbacks: FeedbackItem[]) => Promise<FeedbackResult>;
export const postWord: (word: Omit<WordDetail, 'level' | 'next_review' | 'interval_days' | 'error_count' | 'review_count' | 'history' | 'added'>) => Promise<any>;
export const deleteWord: (word: string) => Promise<any>;
