import { z } from "zod";
import { Word, createStorageFromEnv } from "vocab-core";
import { getNow, addMinutes, processReviewFeedbacks } from "vocab-core/algorithm";
import { lemmatize } from "vocab-core/lemmatizer";
import type { StorageConnection } from "vocab-core/storage";

// Create shared storage instance for the MCP server
let storage: StorageConnection | null = null;

function getStorage(): StorageConnection {
  if (!storage) {
    storage = createStorageFromEnv();
  }
  return storage;
}

// MCP 工具定义
interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  execute: (args?: any) => Promise<any>;
}

function createTools(): Tool[] {
  return [
    // 1. vocab_review - 获取今日待复习单词
    {
      name: "vocab_review",
      description: "获取今日待复习的单词列表",
      inputSchema: {},
      execute: async () => {
        const db = getStorage();
        const data = db.loadData();
        const dueWords = db.getDueWords();
        // 随机打乱顺序
        const shuffled = dueWords.sort(() => Math.random() - 0.5);

        return {
          words: shuffled,
          count: shuffled.length,
          streak: data.streak,
          last_review_date: data.last_review_date
        };
      }
    },

    // 2. vocab_add_word - 添加新词
    {
      name: "vocab_add_word",
      description: "添加新词到词库",
      inputSchema: {
        word: z.string(),
        meaning: z.string().optional(),
        phonetic: z.string().optional(),
        pos: z.string().optional(),
        example: z.string().optional(),
        example_cn: z.string().optional(),
        examples: z.array(z.object({ en: z.string(), cn: z.string() })).optional(),
        collocations: z.array(z.string()).optional(),
        synonyms: z.array(z.string()).optional(),
        antonyms: z.array(z.string()).optional(),
        prototype: z.string().optional(),
        variant: z.array(z.object({ form: z.string(), value: z.string() })).optional(),
        etymology: z.string().optional(),
        source: z.string().optional()
      },
      execute: async (args: any) => {
        const db = getStorage();

        // Lemmatize the word to its base form
        const lemma = lemmatize(args.word);
        const wordLower = lemma.toLowerCase();

        const existing = db.loadData().words.find(
          w => w.word.toLowerCase() === wordLower
        );

        if (existing) {
          return {
            success: false,
            word: existing.word,
            level: existing.level,
            next_review: existing.next_review,
            message: `单词 "${existing.word}" 已存在，当前 level: ${existing.level}`
          };
        }

        const now = getNow();
        const firstReview = now; // 新词立即可复习

        const newWord: Word = {
          word: wordLower,
          meaning: args.meaning || "",
          phonetic: args.phonetic || "",
          pos: args.pos || "",
          example: args.example || "",
          example_cn: args.example_cn || "",
          examples: args.examples || [],
          collocations: args.collocations || [],
          synonyms: args.synonyms || [],
          antonyms: args.antonyms || [],
          source: args.source || "user",
          added: now,
          level: 0,
          next_review: firstReview,
          interval_minutes: 20,
          error_count: 0,
          review_count: 0,
          history: [],
          prototype: args.prototype || "",
          variant: args.variant || [],
          etymology: args.etymology || ""
        };

        db.addWord(newWord);

        return {
          success: true,
          word: wordLower,
          level: 0,
          next_review: firstReview,
          message: `已添加 "${wordLower}"，可立即复习`
        };
      }
    },

    // 3. vocab_review_feedback - 提交复习反馈
    {
      name: "vocab_review_feedback",
      description: "提交复习反馈，更新单词状态（支持批量）",
      inputSchema: {
        feedbacks: z.array(z.object({
          word: z.string(),
          feedback: z.enum(["pass", "fail", "fuzzy"])
        }))
      },
      execute: async (args: any) => {
        const db = getStorage();

        // Lemmatize all feedback words to match stored lemma
        const lemmatizedFeedbacks = args.feedbacks.map((f: any) => ({
          word: lemmatize(f.word),
          feedback: f.feedback
        }));

        const { results, summary, updatedStreak } = processReviewFeedbacks(
          db,
          lemmatizedFeedbacks
        );

        return {
          success: true,
          results,
          summary,
          updated_streak: updatedStreak,
          message: `复习完成！通过 ${summary.passed}，失败 ${summary.failed}，模糊 ${summary.fuzzy}`
        };
      }
    },

    // 4. vocab_get_status - 获取词库状态
    {
      name: "vocab_get_status",
      description: "获取词库整体状态",
      inputSchema: {},
      execute: async () => {
        const db = getStorage();
        const data = db.loadData();
        const now = getNow();
        const tomorrow = addMinutes(now, 1440); // 24小时后

        const levelStats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
        data.words.forEach(w => {
          levelStats[w.level] = (levelStats[w.level] || 0) + 1;
        });

        const todayDue = data.words.filter(w => w.next_review <= now).length;
        const tomorrowDue = data.words.filter(w => w.next_review > now && w.next_review <= tomorrow).length;

        return {
          total_words: data.words.length,
          level_stats: levelStats,
          streak: data.streak,
          today_due: todayDue,
          tomorrow_due: tomorrowDue,
          total_reviews: data.total_reviews
        };
      }
    },

    // 5. vocab_list_words - 列出单词
    {
      name: "vocab_list_words",
      description: "列出单词（支持筛选）",
      inputSchema: {
        filter: z.enum(["all", "new", "learning", "hard", "mastered", "today"]).optional(),
        limit: z.number().optional()
      },
      execute: async (args: any) => {
        const db = getStorage();
        const words = db.getWordsByFilter(args.filter);
        const limited = args.limit ? words.slice(0, args.limit) : words;

        return {
          words: limited.map(w => ({
            word: w.word,
            meaning: w.meaning,
            level: w.level,
            next_review: w.next_review,
            error_count: w.error_count
          })),
          total: words.length
        };
      }
    },

    // 6. vocab_remove_word - 移除单词
    {
      name: "vocab_remove_word",
      description: "从词库移除单词",
      inputSchema: {
        word: z.string()
      },
      execute: async (args: any) => {
        const db = getStorage();
        // Lemmatize to find the word
        const lemma = lemmatize(args.word);
        const success = db.removeWord(lemma);
        return {
          success,
          message: success ? `已移除 "${lemma}"` : `未找到 "${args.word}"`
        };
      }
    },

    // 7. vocab_get_word_detail - 获取单词详情
    {
      name: "vocab_get_word_detail",
      description: "获取单词详情（用于学习模式）",
      inputSchema: {
        word: z.string()
      },
      execute: async (args: any) => {
        const db = getStorage();
        // Lemmatize to find the word
        const lemma = lemmatize(args.word);
        const word = db.getWord(lemma);
        if (!word) {
          return { error: `未找到单词 "${args.word}"` };
        }
        return word;
      }
    }
  ];
}

export { createTools, Tool };
