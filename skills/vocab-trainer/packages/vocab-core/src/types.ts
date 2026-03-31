export interface ReviewRecord {
  date: string;          // 复习时间 (ISO8601 datetime)
  result: "pass" | "fail" | "fuzzy";
}

export interface VariantEntry {
  form: string;  // e.g., "past", "pp", "ing"
  value: string; // e.g., "walked", "walking"
}

export interface Word {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  level: number;              // 0-9
  next_review: string;         // ISO8601 datetime
  interval_minutes: number;    // 间隔分钟数
  error_count: number;
  review_count: number;
  history: ReviewRecord[];
  prototype: string;
  variant: VariantEntry[];
  etymology: string;
}

export interface VocabData {
  version: number;
  streak: number;
  last_review_date: string | null;  // ISO8601 datetime
  total_reviews: number;
  words: Word[];
}

export interface FeedbackItem {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
}

export interface ReviewResult {
  word: string;
  old_level: number;
  new_level: number;
  next_review: string;       // ISO8601 datetime
  interval_minutes: number;  // 间隔分钟数
}

export interface ReviewSummary {
  passed: number;
  failed: number;
  fuzzy: number;
}

// MCP 工具返回类型
export interface VocabReviewResponse {
  words: Word[];
  count: number;
  streak: number;
  last_review_date: string | null;
}

export interface VocabAddResponse {
  success: boolean;
  word: string;
  level: number;
  next_review: string;
  message: string;
}

export interface VocabFeedbackResponse {
  success: boolean;
  results: ReviewResult[];
  summary: ReviewSummary;
  updated_streak: number;
  message: string;
}

export interface VocabStatusResponse {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}

export interface VocabListResponse {
  words: Pick<Word, "word" | "meaning" | "level" | "next_review" | "error_count">[];
  total: number;
}

export interface VocabRemoveResponse {
  success: boolean;
  message: string;
}

export interface VocabWordDetailResponse extends Word {}

export interface EnrichResult {
  prototype: string;
  variant: VariantEntry[];
  etymology: string;
}
