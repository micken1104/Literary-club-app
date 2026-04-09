type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AIRequest = {
  messages: AIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
  jsonMode?: boolean;
};

type AIResponse = {
  result?: {
    response?: string;
  };
  success?: boolean;
  errors?: Array<{ message?: string; code?: number }>;
};

const FIXED_TEMPERATURE = 0.2;
const FIXED_MAX_TOKENS = 500;
const SHORT_OUTPUT_THRESHOLD = 12;
const DEFAULT_FALLBACK_TEXT = "（分析中...）";

export class CloudflareAIClient {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
  }

  private sanitizeGeneratedText(raw: string): string {
    const normalized = String(raw || "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) {
      return "";
    }

    // 本文を残すため、行頭ラベルだけ除去する。
    const cleanedByLine = normalized
      .split("\n")
      .map((line) =>
        line
          .replace(/^\s*(講評|総評|分析|回答|編集者)\s*[:：]\s*/i, "")
          .replace(/^\s*(1文目|2文目|一文目|二文目)\s*[:：]\s*/i, "")
          .replace(/^\s*[-*・]\s+/, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .trim()
      )
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!cleanedByLine) {
      return "";
    }

    return cleanedByLine.replace(/[\t\f\v ]+/g, " ").trim();
  }

  private withFallback(text: string): string {
    const normalized = String(text || "").trim();
    if (!normalized || normalized.length < SHORT_OUTPUT_THRESHOLD) {
      return DEFAULT_FALLBACK_TEXT;
    }
    return normalized;
  }

  async generateText(request: AIRequest): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/@cf/meta/llama-3.1-8b-instruct`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: request.messages,
          max_tokens: FIXED_MAX_TOKENS,
          temperature: FIXED_TEMPERATURE,
          top_p: request.top_p ?? 0.7,
          repetition_penalty: request.repetition_penalty ?? 1.15,
        }),
      });

      if (!response.ok) {
        return DEFAULT_FALLBACK_TEXT;
      }

      const data = (await response.json()) as AIResponse;
      const raw = String(data.result?.response || "").trim();

      if (request.jsonMode) {
        return this.withFallback(raw);
      }

      const result = this.sanitizeGeneratedText(raw);
      return this.withFallback(result);
    } catch (error) {
      console.error("AI Client Error:", error);
      return DEFAULT_FALLBACK_TEXT;
    }
  }

  async generatePostReview(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたはポジティブな読者である。講評・感想は2文で書け。改善提案、否定、見出し、ラベル出力は禁止。",
        },
        {
          role: "assistant",
          content:
            "空間把握能力と叙情性のバランスが秀逸です。LEDへの変遷を「冷たい態度」と捉える感性や、最後にオリオン座という「変わらないもの」へ回帰する構成が美しく、一文一文の比重が重く読み応えがあります。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n作品名: ${title}\n本文: ${content.slice(0, 1800)}`,
        },
      ],
      max_tokens: FIXED_MAX_TOKENS,
      temperature: FIXED_TEMPERATURE,
    });
  }

  async generateWeeklySummary(postsData: {
    totalPosts: number;
    posts?: Array<{ author: string; title: string; body: string }>;
  }): Promise<string> {
    const list = (postsData.posts || []).map((p) => `・${p.author}「${p.title}」`).join("\n");

    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌の編集者である。週間総評は3文で書け。だ・である調のみを使い、です・ます調は禁止。自分語り、見出し、ラベル出力、否定は禁止。",
        },
        {
          role: "assistant",
          content:
            "今週も素晴らしい創作活動をありがとうございました。恋愛、冒険、日常と、多彩なテーマでの表現が見られ、部員の皆さんの創作の幅の広さが感じられます。特に風や心といったキーワードを通じた感情表現が豊かでした。来週も皆さんの創意工夫を期待しています！",
        },
        {
          role: "user",
          content: `投稿数: ${postsData.totalPosts}件\n投稿一覧:\n${list}`,
        },
      ],
      max_tokens: FIXED_MAX_TOKENS,
      temperature: FIXED_TEMPERATURE,
    });
  }

  async generateIndividualAnalysis(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたはポジティブな読者である。講評・感想は３文で書け。改善提案、否定、見出し、ラベル出力は禁止。",
        },
        {
          role: "assistant",
          content:
            "空間把握能力と叙情性のバランスが秀逸です。LEDへの変遷を「冷たい態度」と捉える感性や、最後にオリオン座という「変わらないもの」へ回帰する構成が美しく、一文一文の比重が重く読み応えがあります。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n題名: ${title}\n本文: ${content.slice(0, 1500)}`,
        },
      ],
      max_tokens: FIXED_MAX_TOKENS,
      temperature: FIXED_TEMPERATURE,
    });
  }

  async analyzeMemberProfile(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
    const list = posts.map((p) => `『${p.title}』`).join("、");

    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌の編集者である。分析は日本語1文のみで書け。題名引用、記号過多、見出し、ラベル、改善提案、否定は禁止。だ・である調のみを使い、です・ます調は禁止。",
        },
        {
          role: "assistant",
          content:
            "日常生活の中に潜む感動や心情を表現することに重点を置いていることが多い",
        },
        {
          role: "user",
          content: `${memberName}の対象作品: ${list}`,
        },
      ],
      max_tokens: FIXED_MAX_TOKENS,
      temperature: FIXED_TEMPERATURE,
    });
  }
}

export function getAIClient(): CloudflareAIClient {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials are not configured.");
  }

  return new CloudflareAIClient(accountId, apiToken);
}
