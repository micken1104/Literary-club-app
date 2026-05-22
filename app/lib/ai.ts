// ai-client.ts

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
  result?: { response?: string };
  success?: boolean;
  errors?: Array<{ message?: string; code?: number }>;
};

// CHANGED: ハッシュタグ用の型を追加（JSONオブジェクト形式に変更）
type HashtagResponse = {
  hashtags: string[];
};

const FIXED_TEMPERATURE = 0.2;
// CHANGED: 500 → 400（1投稿分の短評に絞ることで truncation を減らす）
const FIXED_MAX_TOKENS = 400;
const SHORT_OUTPUT_THRESHOLD = 12;
const DEFAULT_FALLBACK_TEXT = "（分析中...）";
// CHANGED: ハッシュタグのフォールバック値を定数化
const DEFAULT_HASHTAG_FALLBACK: string[] = ["#純文学", "#情景描写", "#日常"];

export const MEMBER_HASHTAG_POOL = [
  "#純文学", "#エンタメ", "#情景描写", "#比喩", "#心理描写",
  "#叙情的", "#難解", "#軽妙", "#伝統的", "#前衛的",
  "#口語体", "#文語体", "#一人称", "#三人称", "#硬派",
  "#装飾的", "#簡潔", "#独白体", "#書簡体", "#饒舌",
  "#青春", "#幻想的", "#写実的", "#耽美", "#退廃的",
  "#日常", "#シュール", "#哲学的", "#ノスタルジー", "#不条理",
  "#諷刺", "#微熱", "#静謐", "#殺伐", "#滑稽",
  "#牧歌的", "#都会的", "#土着的", "#センチメンタル", "#サイケデリック",
  "#孤独", "#焦燥", "#救済", "#祝祭", "#エロス",
  "#タナトス", "#境界", "#異類婚姻", "#家族", "#祈り",
  "#喪失", "#再生",
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

  // CHANGED: Markdownコードブロックの剥離を追加
  // CHANGED: **bold** の除去を追加
  // CHANGED: 末尾句点の補完条件に「」も追加（Gemini案）
  private sanitizeGeneratedText(raw: string): string {
    let normalized = String(raw || "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) return "";

    // Markdownコードブロック（```json ... ``` や ``` ... ```）を剥がす
    normalized = normalized.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").trim();
    // インラインbold記法を除去
    normalized = normalized.replace(/\*\*([^*]+)\*\*/g, "$1");

    const cleanedByLine = normalized
      .split("\n")
      .map((line) =>
        line
          // 行頭の見出しプレフィックス（# * 付きも対応）を除去
          .replace(/^\s*[#*]*\s*(講評|総評|分析|回答|編集者|感想|レビュー)\s*[:：]\s*/i, "")
          // 鉤括弧・引用符で囲まれた行はその中身だけ取り出す
          .replace(/^["'「](.*)["'」]$/, "$1")
          .trim()
      )
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!cleanedByLine) return "";

    const normalizedSpaces = cleanedByLine.replace(/[\t\f\v ]+/g, " ").trim();
    // 句点または閉じ鉤括弧で終わっていれば補完しない
    return normalizedSpaces.match(/[。」]$/) ? normalizedSpaces : `${normalizedSpaces}。`;
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
          max_tokens: request.max_tokens ?? FIXED_MAX_TOKENS,
          temperature: request.temperature ?? FIXED_TEMPERATURE,
          top_p: request.top_p ?? 0.7,
          repetition_penalty: request.repetition_penalty ?? 1.15,
        }),
      });

      if (!response.ok) {
        console.error("Cloudflare AI HTTP error:", response.status, response.statusText);
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

  // CHANGED: 「文章N文ちょうど」→「N字程度」に変更（Llamaは文数カウントが苦手）
  // CHANGED: ポジティブバイアス解消——ダークなテーマ・心理も正確に捉えることを明示
  // CHANGED: あらすじ禁止・批評軸（文体・語彙・余韻）を明示
  // CHANGED: few-shot例文を「語彙選択・緊張感・余韻」に言及する型に差し替え
  async generatePostReview(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content: [
            "あなたは純文学の批評家である。",
            "与えられた作品を読み、その文学的個性を称賛する批評文を書け。",
            "作品が持つ固有の雰囲気（美しさだけでなく、人間のエゴ・暗い欲動・不条理な感情も含む）を正確に捉え、表層のストーリーではなく文学的技巧を評価すること。",
            "批評では必ず以下のいずれかの軸に言及すること：",
            "文体の質感・語彙の選択・文章の緊張感・比喩や象徴・構成の妙・余白や省略の効果・読後の余韻。",
            "厳守事項：",
            "1. 必ず『です・ます』調で書くこと。",
            "2. 100〜160文字程度に収めること。",
            "3. あらすじや内容の再説明は絶対禁止。登場人物・事件・結末を説明してはならない。",
            "4. ラベル・見出し・Markdown記法・改善提案は禁止。",
          ].join("\n"),
        },
        {
          role: "assistant",
          content:
            "文語と口語の間を揺れる語彙の選択が、語り手の内面的な葛藤をそのまま文体として体現しています。最後の一文に凝縮された逆説が、読後も長く胸の中で震え続けます。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n作品名: ${title}\n本文:\n${content.slice(0, 1500)}`,
        },
      ],
    });
  }

  // CHANGED: 投稿リストに本文冒頭100字を付与（モデルが作風を実際に参照できるようにする）
  // CHANGED: 「文章3文ちょうど」→「150〜250文字程度」
  // CHANGED: あらすじ禁止・批評軸（文体傾向・技法の多様性）を明示
  // CHANGED: few-shot例文を「文体傾向・余白・多様性」に言及する型に差し替え
  async generateWeeklySummary(postsData: {
    totalPosts: number;
    posts?: Array<{ author: string; title: string; body: string }>;
  }): Promise<string> {
    const list = (postsData.posts || [])
      .map((p) => `・${p.author}「${p.title}」——${p.body.slice(0, 100).replace(/\r?\n/g, " ")}…`)
      .join("\n");

    return this.generateText({
      messages: [
        {
          role: "system",
          content: [
            "あなたはベテランの文芸編集者である。",
            "今週の投稿群を文学的な観点から総括する批評文を書け。",
            "各作品の雰囲気（美しさだけでなく、暗さ・エゴ・不条理も含む）を正確に踏まえた上で横断的に評価すること。",
            "批評では必ず以下のいずれかの軸に言及すること：",
            "投稿群に通底する文体の傾向・語彙の使い方の際立ち・表現技法の多様性・お題への各作品のアプローチの違い。",
            "厳守事項：",
            "1. 必ず『だ・である』調で書くこと（です・ます禁止）。",
            "2. 150〜250文字程度に収めること。",
            "3. 特定の投稿のあらすじを説明してはならない。",
            "4. ラベル・自己紹介・Markdown記法は禁止。",
          ].join("\n"),
        },
        {
          role: "assistant",
          content:
            "今週の投稿群は、口語体の速度感と文語体の重みを意図的に混在させる実験的な試みが目立ち、お題への接近角度の多様さが際立っている。語彙の密度よりも余白と沈黙の使い方に各作者の個性が現れており、行間に思想を宿らせる力量が全体的に高い水準にある。来週もこの緊張感ある模索を続けてほしい。",
        },
        {
          role: "user",
          content: `投稿数: ${postsData.totalPosts}件\n投稿一覧:\n${list}`,
        },
      ],
      // CHANGED: 複数作品を扱うため max_tokens を増やす
      max_tokens: 500,
    });
  }

  // CHANGED: 投稿リストに本文冒頭200字を付与（作風を読んで判断させる）
  // CHANGED: 「日本語1文のみ」→「60〜100文字程度の1文」
  // CHANGED: 「抽象的な褒め言葉のみの文は禁止」を追加
  // CHANGED: あらすじ禁止・具体的な文体軸を明示
  // CHANGED: few-shot例文を「視点・語彙の速度感・感情処理」に言及する型に差し替え
  async analyzeMemberProfile(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
    const list = posts
      .map((p) => `『${p.title}』冒頭：${String(p.body || "").slice(0, 200).replace(/\r?\n/g, " ")}`)
      .join("\n");

    return this.generateText({
      messages: [
        {
          role: "system",
          content: [
            "あなたは文芸編集者として、作家の作風を批評的に分析する。",
            "複数の作品を横断した上で、この作者に固有の文体的特徴を言語化せよ。",
            "言及すべき軸：文体の質感（硬・軟・速・遅）・語彙の傾向・視点の取り方・感情の処理の仕方・構成の癖のうち最も特徴的なものを選ぶこと。",
            "厳守事項：",
            "1. 必ず『だ・である』調の日本語1文のみで書くこと。60〜100文字程度。",
            "2. 題名の引用・あらすじの説明・改善提案は絶対禁止。",
            "3. 「独特」「巧み」「鮮やか」など抽象的な褒め言葉だけの文は禁止。必ず具体的な文体的特徴を含めること。",
            "4. Markdown記法は禁止。",
          ].join("\n"),
        },
        {
          role: "assistant",
          content:
            "三人称の乾いた距離感を保ちながら、感情語を一切排した体感的な語彙——温度、速度、圧力——だけで登場人物の内面を描出する文体が、作者固有の様式として一貫している。",
        },
        {
          role: "user",
          content: `作者: ${memberName}\n対象作品:\n${list}`,
        },
      ],
      max_tokens: 200,
    });
  }

  // CHANGED: 「文章3文ちょうど」→「150〜220文字程度」
  // CHANGED: ポジティブバイアス解消——ダークなテーマも正確に捉えることを明示
  // CHANGED: あらすじ禁止・批評軸（文体・構成・余韻）を2つ以上使う制約を明示
  // CHANGED: few-shot例文を「速度感・抑制・余韻」3軸に言及する型に差し替え
  async generateIndividualAnalysis(title: string, content: string, topicTitle?: string): Promise<string> {
    return this.generateText({
      messages: [
        {
          role: "system",
          content: [
            "あなたは純文学の批評家である。",
            "与えられた作品の文学的個性を称賛する批評文を書け。",
            "作品が持つ固有の雰囲気（美しさだけでなく、人間のエゴ・暗い欲動・不条理な感情も含む）を正確に捉えること。",
            "批評では必ず以下の軸のうち2つ以上に言及すること：",
            "文体の質感・語彙の密度と選択・構成の妙（冒頭・転換・結末）・比喩や象徴の機能・余白や沈黙の効果・感情処理の方法・読後の余韻。",
            "厳守事項：",
            "1. 必ず『です・ます』調で書くこと。",
            "2. 150〜220文字程度に収めること。",
            "3. あらすじや内容の再説明は絶対禁止。登場人物の行動・事件の経緯・結末を説明してはならない。",
            "4. ラベル・見出し・Markdown記法・改善提案は禁止。",
          ].join("\n"),
        },
        {
          role: "assistant",
          content:
            "文体の速度が意図的に緩急を刻んでおり、静止に近い描写と突然の跳躍が交互に現れることで、独特の呼吸のリズムが生まれています。感情を直接語らず、感覚的な語彙だけで内面を描出する抑制の技法が、行間に豊かな余白を生んでいます。結末の一文が前景の静けさと鋭く対照をなし、読後もその緊張が長く尾を引きます。",
        },
        {
          role: "user",
          content: `お題: ${topicTitle || "未指定"}\n題名: ${title}\n本文:\n${content.slice(0, 1500)}`,
        },
      ],
    });
  }

  // CHANGED: JSONをオブジェクト形式 {"hashtags": [...]} に変更（配列直接出力はパースが不安定）
  // CHANGED: 安全なJSONパースとフォールバックを実装
  // CHANGED: 返り値の型を string から string[] に変更（呼び出し元の修正が必要）
  // CHANGED: temperature をさらに低く（0.15 → 0.1）してブレを抑制
  async generateMemberHashtags(memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string[]> {
    const lines = posts.map((post, index) => {
      const body = String(post.body || "").slice(0, 1000);
      return `作品${index + 1}: ${post.title}\n${body}`;
    }).join("\n\n");

    const raw = await this.generateText({
      messages: [
        {
          role: "system",
          content: [
            "あなたは文芸作品の分析者である。",
            "提供された作品群の文体・雰囲気・テーマを分析し、指定されたプールから最も適切なハッシュタグを3つ選べ。",
            "【選択プール】:",
            "1. 文体・テクニック: #純文学, #エンタメ, #情景描写, #比喩, #心理描写, #叙情的, #難解, #軽妙, #伝統的, #前衛的, #口語体, #文語体, #一人称, #三人称, #硬派, #装飾的, #簡潔, #独白体, #書簡体, #饒舌",
            "2. 雰囲気・情緒: #青春, #幻想的, #写実的, #耽美, #退廃的, #日常, #シュール, #哲学的, #ノスタルジー, #不条理, #諷刺, #微熱, #静謐, #殺伐, #滑稽, #牧歌的, #都会的, #土着的, #センチメンタル, #サイケデリック",
            "3. テーマ・モチーフ: #孤独, #焦燥, #救済, #祝祭, #エロス, #タナトス, #境界, #異類婚姻, #家族, #祈り, #喪失, #再生",
            "【出力形式】:",
            '必ず次のJSONフォーマットのみを返すこと。前置き・解説・コードブロック（```）は一切禁止。',
            '{ "hashtags": ["#タグ1", "#タグ2", "#タグ3"] }',
            "プール外のタグは絶対に出力しないこと。重複禁止。",
          ].join("\n"),
        },
        {
          role: "assistant",
          content: '{ "hashtags": ["#叙情的", "#心理描写", "#ノスタルジー"] }',
        },
        {
          role: "user",
          content: `作者: ${memberName}\n\n対象作品:\n${lines}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.1,
      top_p: 0.2,
      repetition_penalty: 1.05,
      jsonMode: true,
    });

    try {
      // コードブロックが混入した場合の防衛
      const cleanJson = raw.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").trim();
      const parsed = JSON.parse(cleanJson) as HashtagResponse;
      if (parsed && Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0) {
        return parsed.hashtags.slice(0, 3);
      }
    } catch (e) {
      console.error("Hashtag JSON parse error. Raw output:", raw);
    }

    return DEFAULT_HASHTAG_FALLBACK;
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