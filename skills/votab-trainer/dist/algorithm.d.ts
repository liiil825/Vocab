import { ReviewResult, ReviewSummary, FeedbackItem } from "./types.js";
export declare function getToday(): string;
export declare function addDays(date: string, days: number): string;
export declare function calculateNextReview(currentLevel: number, feedback: "pass" | "fail" | "fuzzy"): {
    newLevel: number;
    intervalDays: number;
};
export declare function processReviewFeedbacks(feedbacks: FeedbackItem[]): {
    results: ReviewResult[];
    summary: ReviewSummary;
    updatedStreak: number;
};
