export interface ReviewRecord {
    date: string;
    result: "pass" | "fail" | "fuzzy";
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
    level: number;
    next_review: string;
    interval_days: number;
    error_count: number;
    review_count: number;
    history: ReviewRecord[];
}
export interface VocabData {
    version: number;
    streak: number;
    last_review_date: string | null;
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
    next_review: string;
    interval_days: number;
}
export interface ReviewSummary {
    passed: number;
    failed: number;
    fuzzy: number;
}
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
export interface VocabWordDetailResponse extends Word {
}
