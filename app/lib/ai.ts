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

export class CloudflareAIClient {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
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
          max_tokens: request.max_tokens ?? 320,
          temperature: request.temperature ?? 0.2,
          top_p: request.top_p ?? 0.7,
          repetition_penalty: request.repetition_penalty ?? 1.15,
        }),
      });

      if (!response.ok) return "";
      const data = (await response.json()) as AIResponse;
      let result = String(data.result?.response || "").trim();

      if (request.jsonMode) {
        return result;
      }

      // If the model starts outputting forbidden section headings, cut everything from that heading onward.
      const sectionHeadingRegex = /(?:^|\n)\s*(心に響いた表現|分析|今週の白眉)\s*[:：]?/m;
      const headingMatch = result.match(sectionHeadingRegex);
      if (headingMatch && headingMatch.index !== undefined) {
        result = result.slice(0, headingMatch.index).trim();
      }

      // Remove leading labels and formatting noise.
      result = result
        .replace(/^(講評|総評|分析|回答|編集者)\s*[:：]\s*/gi, "")
        .replace(/^\s*(1文目|2文目|一文目|二文目)\s*[:：]\s*/gim, "")
        .replace(/^\s*[\-*・]\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

      return result;
    } catch (error) {
      console.error("AI Client Error:", error);
      return "（生成失敗）";
    }
  }

  async generatePostReview(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌のプロ編集者だ。常に作品の称賛だけを書く。敬語（です・ます）を使わず、だ・である調のみを使う。改善案・助言・否定評価・減点表現は禁止。説明用ラベル（例: 1文目は〜）や見出しは禁止。",
        },
        {
          role: "user",
          content: "出力形式の例を1つ示せ。",
        },
        {
          role: "assistant",
          content:
            "比喩の切れ味が鋭く、短いフレーズごとに情景が立ち上がる構成だ。お題への応答も直線的な説明に逃げず、語彙の選択そのものが主題を押し広げる力を持っている。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n作品名: ${title}\n本文: ${content.slice(0, 1800)}`,
        },
      ],
      max_tokens: 260,
      temperature: 0.2,
    });
  }

  async generateWeeklySummary(postsData: {
    totalPosts: number;
    posts?: Array<{ author: string; title: string; body: string }>;
  }): Promise<string> {
    const list = (postsData.posts || [])
      .map((p) => `・${p.author}「${p.title}」`)
      .join("\n");

    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌のプロ編集者だ。週間総評を3文以内で書く。敬語（です・ます）禁止、だ・である調のみ。AI自身の趣味・嗜好・自分語りは禁止。改善案・否定評価は禁止。",
        },
        {
          role: "user",
          content: "出力形式の例を1つ示せ。",
        },
        {
          role: "assistant",
          content:
            "今週の投稿群は、語彙の選択と視点の切り替えに明確な強度があり、読み味の層が厚い。題材の重なりを逆手に取り、各作者が異なる温度で主題を再構成した点が際立つ。全体として創作姿勢の密度が高く、次週への期待が自然に高まる。",
        },
        {
          role: "user",
          content: `投稿数: ${postsData.totalPosts}件\n投稿一覧:\n${list}`,
        },
      ],
      max_tokens: 220,
      temperature: 0.2,
    });
  }

  async generateIndividualAnalysis(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌のプロ編集者だ。2文のみで講評を書く。敬語（です・ます）禁止、だ・である調のみ。1文目は作品の光っている点を具体的に称賛し、2文目はお題への満たし方を称賛する。改善案・助言・否定評価・ラベル出力は禁止。",
        },
        {
          role: "user",
          content: "出力形式の例を1つ示せ。",
        },
        {
          role: "assistant",
          content:
            "描写の焦点がぶれず、細部の比喩が物語の緊張を持続させる構造だ。お題への応答も発想の飛躍を言葉の精度で支え、主題を過不足なく作品の芯に定着させている。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n題名: ${title}\n本文: ${content.slice(0, 1500)}`,
        },
      ],
      max_tokens: 220,
      temperature: 0.2,
    });
  }

  async analyzeMemberProfile(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
    const list = posts.map((p) => `『${p.title}』`).join("、");

    return this.generateText({
      messages: [
        {
          role: "system",
          content:
            "あなたは商業文芸誌のプロ編集者だ。作家分析は1文のみで出力する。敬語（です・ます）禁止、だ・である調のみ。改善案・否定評価・ラベル出力は禁止。",
        },
        {
          role: "user",
          content: "出力形式の例を1つ示せ。",
        },
        {
          role: "assistant",
          content:
            "語彙の密度で情景を立ち上げる手つきが一貫しており、主題をねじらず深く掘る構文選択にこの作家固有の強度がある。",
        },
        {
          role: "user",
          content: `${memberName}の対象作品: ${list}`,
        },
      ],
      max_tokens: 160,
      temperature: 0.2,
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
