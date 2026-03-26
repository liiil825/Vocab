import { VocabData, Word } from "./types.js";
import {
  loadData,
  addWord,
  getWord,
  removeWord,
  getWordsByFilter,
  getDueWords
} from "./storage.js";
import { processReviewFeedbacks, getToday, addDays } from "./algorithm.js";

// MCP 工具定义
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args?: any) => Promise<any>;
}

function createTools(): Tool[] {
  return [
    // 1. vocab_review - 获取今日待复习单词
    {
      name: "vocab_review",
      description: "获取今日待复习的单词列表",
      inputSchema: {
        type: "object",
        properties: {}
      },
      execute: async () => {
        const data = loadData();
        const dueWords = getDueWords();
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
        type: "object",
        properties: {
          word: { type: "string", description: "单词" },
          meaning: { type: "string", description: "中文释义" },
          phonetic: { type: "string", description: "音标" },
          pos: { type: "string", description: "词性" },
          example: { type: "string", description: "英文例句" },
          example_cn: { type: "string", description: "例句中文翻译" },
          source: { type: "string", description: "来源" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const wordLower = args.word.toLowerCase();
        const existing = loadData().words.find(
          w => w.word.toLowerCase() === wordLower
        );

        if (existing) {
          return {
            success: false,
            word: args.word,
            level: existing.level,
            next_review: existing.next_review,
            message: `单词 "${args.word}" 已存在，当前 level: ${existing.level}`
          };
        }

        const today = getToday();
        const tomorrow = addDays(today, 1);

        const newWord: Word = {
          word: wordLower,
          meaning: args.meaning || "",
          phonetic: args.phonetic || "",
          pos: args.pos || "",
          example: args.example || "",
          example_cn: args.example_cn || "",
          source: args.source || "user",
          added: today,
          level: 0,
          next_review: tomorrow,
          interval_days: 1,
          error_count: 0,
          review_count: 0,
          history: []
        };

        addWord(newWord);

        return {
          success: true,
          word: args.word,
          level: 0,
          next_review: tomorrow,
          message: `已添加 "${args.word}"，首次复习：${tomorrow}`
        };
      }
    },

    // 3. vocab_review_feedback - 提交复习反馈
    {
      name: "vocab_review_feedback",
      description: "提交复习反馈，更新单词状态（支持批量）",
      inputSchema: {
        type: "object",
        properties: {
          feedbacks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                feedback: { type: "string", enum: ["pass", "fail", "fuzzy"] }
              },
              required: ["word", "feedback"]
            },
            description: "复习反馈数组"
          }
        },
        required: ["feedbacks"]
      },
      execute: async (args: any) => {
        const { results, summary, updatedStreak } = processReviewFeedbacks(
          args.feedbacks
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
      inputSchema: {
        type: "object",
        properties: {}
      },
      execute: async () => {
        const data = loadData();
        const today = getToday();
        const tomorrow = addDays(today, 1);

        const levelStats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        data.words.forEach(w => {
          levelStats[w.level] = (levelStats[w.level] || 0) + 1;
        });

        const todayDue = data.words.filter(w => w.next_review <= today).length;
        const tomorrowDue = data.words.filter(w => w.next_review === tomorrow).length;

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
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "new", "learning", "hard", "mastered", "today"],
            description: "筛选条件"
          },
          limit: { type: "number", description: "返回数量限制" }
        }
      },
      execute: async (args: any) => {
        const words = getWordsByFilter(args.filter);
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
        type: "object",
        properties: {
          word: { type: "string", description: "要移除的单词" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const success = removeWord(args.word);
        return {
          success,
          message: success ? `已移除 "${args.word}"` : `未找到 "${args.word}"`
        };
      }
    },

    // 7. vocab_get_word_detail - 获取单词详情
    {
      name: "vocab_get_word_detail",
      description: "获取单词详情（用于学习模式）",
      inputSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "单词" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const word = getWord(args.word);
        if (!word) {
          return { error: `未找到单词 "${args.word}"` };
        }
        return word;
      }
    }
  ];
}

export { createTools, Tool };