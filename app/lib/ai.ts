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

export const MEMBER_HASHTAG_POOL = [
  "#純文学",
  "#エンタメ",
  "#情景描写",
  "#比喩",
  "#心理描写",
  "#叙情的",
  "#難解",
  "#軽妙",
  "#伝統的",
  "#前衛的",
  "#口語体",
  "#文語体",
  "#一人称",
  "#三人称",
  "#硬派",
  "#装飾的",
  "#簡潔",
  "#独白体",
  "#書簡体",
  "#饒舌",
  "#青春",
  "#幻想的",
  "#写実的",
  "#耽美",
  "#退廃的",
  "#日常",
  "#シュール",
  "#哲学的",
  "#ノスタルジー",
  "#不条理",
  "#諷刺",
  "#微熱",
  "#静謐",
  "#殺伐",
  "#滑稽",
  "#牧歌的",
  "#都会的",
  "#土着的",
  "#センチメンタル",
  "#サイケデリック",
  "#孤独",
  "#焦燥",
  "#救済",
  "#祝祭",
  "#エロス",
  "#タナトス",
  "#境界",
  "#異類婚姻",
  "#家族",
  "#祈り",
  "#喪失",
  "#再生",
] as const;

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
    if (!normalized) return "";

    const cleanedByLine = normalized
      .split("\n")
      .map((line) =>
        line
          .replace(/^\s*(講評|総評|分析|回答|編集者|感想|レビュー)\s*[:：]\s*/i, "")
          .replace(/^["'「](.*)["'」]$/, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .trim()
      )
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!cleanedByLine) {
      return "";
    }

    const normalizedSpaces = cleanedByLine.replace(/[\t\f\v ]+/g, " ").trim();
    return normalizedSpaces.includes("。") ? normalizedSpaces : `${normalizedSpaces}。`;
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
        return raw || DEFAULT_FALLBACK_TEXT;
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
            "文芸誌の熱心な読者として、作品の魅力を称賛してください。制約：1.必ず『です・ます』調で書くこと。2.文章は2文ちょうどで構成すること。3.ラベル、見出し、改善提案、否定は厳禁。",
        },
        {
          role: "assistant",
          content:
            "冒頭から引き込まれるような独特の世界観が構築されており、言葉選びのセンスに圧倒されました。日常の風景が鮮やかな色彩を帯びていくような読後感は、まさに筆力の賜物と言えます。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n作品名: ${title}\n本文: ${content.slice(0, 1500)}`,
        },
      ],
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
            "ベテラン文芸編集者として今週の投稿を総括せよ。制約：1.必ず『だ・である』調で書くこと（です・ます禁止）。2.文章は3文ちょうどで構成すること。3.ラベル、自己紹介、否定は厳禁。",
        },
        {
          role: "assistant",
          content:
            "今週の投稿群は、日常の断片を鋭く切り取る写実的な作品が揃い、部員の層の厚さを物語っている。特に光や温度といった感覚情報を言語化する試みが随所に見られ、表現の地平が着実に広がっている。来週もこの熱量を維持し、更なる飛躍を期待したい。",
        },
        {
          role: "user",
          content: `投稿数: ${postsData.totalPosts}件\n投稿一覧:\n${list}`,
        },
      ],
    });
  }

  async analyzeMemberProfile(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
    const list = posts.map((p) => `『${p.title}』`).join("、");
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "編集者として作家の作風を分析せよ。制約：1.必ず『だ・である』調で日本語1文のみで書くこと。2.題名の引用、ラベル、改善提案は厳禁。",
        },
        {
          role: "assistant",
          content:
            "緻密な心理描写と静謐な情景描写を織り交ぜることで、孤独の中に微かな救済を見出す独特の文体を確立している。",
        },
        {
          role: "user",
          content: `${memberName}の対象作品: ${list}`,
        },
      ],
    });
  }

  async generateIndividualAnalysis(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "文芸誌の熱心な読者として、作品の魅力を称賛してください。制約：1.必ず『です・ます』調で書くこと。2.文章は3文ちょうどで構成すること。3.ラベル、見出し、改善提案、否定は厳禁。",
        },
        {
          role: "assistant",
          content:
            "導入から終盤まで視線がぶれることなく、作品世界の温度が丁寧に立ち上がっていて見事です。感情の揺れを押しつけずに滲ませる筆致が美しく、読み手の想像力を自然に広げてくれます。語彙の選択にも作者の個性がしっかり刻まれており、読後に強い余韻が残ります。",
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

  async generateMemberHashtags(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
    const lines = posts.map((post, index) => {
      const body = String(post.body || "").slice(0, 1200);
      return `作品${index + 1}: ${post.title}\n${body}`;
    }).join("\n\n");

    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            [
              "あなたは文芸作品の分析者である。",
              "先に作品群を分析し、その分析結果に基づいてハッシュタグを選べ。",
              "タグは必ず以下のプールからのみ選び、プール外の語は絶対に出力しないこと。",
              "1. 文体・テクニック: #純文学, #エンタメ, #情景描写, #比喩, #心理描写, #叙情的, #難解, #軽妙, #伝統的, #前衛的, #口語体, #文語体, #一人称, #三人称, #硬派, #装飾的, #簡潔, #独白体, #書簡体, #饒舌",
              "2. 雰囲気・情緒: #青春, #幻想的, #写実的, #耽美, #退廃的, #日常, #シュール, #哲学的, #ノスタルジー, #不条理, #諷刺, #微熱, #静謐, #殺伐, #滑稽, #牧歌的, #都会的, #土着的, #センチメンタル, #サイケデリック",
              "3. テーマ・モチーフ: #孤独, #焦燥, #救済, #祝祭, #エロス, #タナトス, #境界, #異類婚姻, #家族, #祈り, #喪失, #再生",
              "出力ルール:",
              "- JSON配列のみを出力する。",
              "- 形式は [\"#タグ1\",\"#タグ2\",\"#タグ3\"]。",
              "- 必ず3つ、重複なし。",
              "- 説明文、前置き、コードブロックは禁止。",
            ].join("\n"),
        },
        {
          role: "assistant",
          content:
            '["#叙情的", "#心理描写", "#ノスタルジー"]',
        },
        {
          role: "user",
          content: `作者: ${memberName}\n\n対象作品:\n${lines}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.15,
      top_p: 0.2,
      repetition_penalty: 1.05,
      jsonMode: true,
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
