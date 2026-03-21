import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getD1Client } from "@/app/lib/db";
import { getAIClient } from "@/app/lib/ai";

type AnalysisResponse = {
  overview: string;
  strengths: string[];
  suggestions: string[];
  postFeedback: Array<{
    postId: string;
    title: string;
    praise: string;
  }>;
};

function compactText(value: string | undefined, maxLen: number): string {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, maxLen);
}

function ensureTwoSentences(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "表現の狙いが明確で、読み手に意図が伝わる書き方だ。言葉の選び方にも作品の個性がよく表れている。";
  }

  const sentenceCount = (trimmed.match(/[。！？]/g) || []).length;
  if (sentenceCount >= 2) {
    return trimmed;
  }

  return `${trimmed} 言葉の選び方にも作品の個性がよく表れている。`;
}

function normalizeAnalysisResponse(parsed: AnalysisResponse): AnalysisResponse {
  return {
    overview: compactText(parsed.overview, 320),
    strengths: (parsed.strengths || []).slice(0, 4).map((item) => compactText(item, 70)),
    suggestions: (parsed.suggestions || []).slice(0, 4).map((item) => compactText(item, 70)),
    postFeedback: (parsed.postFeedback || []).slice(0, 40).map((item) => ({
      postId: String(item.postId),
      title: compactText(item.title, 80),
      praise: compactText(item.praise, 800),
    })),
  };
}

function enforcePerReplyFeedback(
  analysis: AnalysisResponse,
  replies: Array<{ id: string; title: string }>
): AnalysisResponse {
  const byPostId = new Map<string, { postId: string; title: string; praise: string }>();
  const byTitle = new Map<string, { postId: string; title: string; praise: string }>();

  for (const item of analysis.postFeedback || []) {
    if (item.postId) {
      byPostId.set(String(item.postId), item);
    }
    if (item.title) {
      byTitle.set(String(item.title), item);
    }
  }

  const exactFeedback = replies.map((reply) => {
    const matched = byPostId.get(reply.id) || byTitle.get(reply.title);
    if (matched) {
      return {
        postId: reply.id,
        title: reply.title,
        praise: compactText(matched.praise, 800),
      };
    }

    return {
      postId: reply.id,
      title: reply.title,
      praise:
        "あらすじ: 主題への視線が一貫しており、作品の狙いが読み手に届く内容だ。 構成: 展開の切り替えが明確で、読み進める導線が整っている。 良かったところ: 語彙の選択に作者らしさがあり、印象の残る表現が複数見られる。",
    };
  });

  return {
    ...analysis,
    postFeedback: exactFeedback,
  };
}

function extractStoredPostAnalysisText(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  // 保存されているのはプレーンテキスト（JSON ではない）なので、そのまま返す
  return raw;
}

async function buildSinglePostAnalysis(
  aiClient: ReturnType<typeof getAIClient>,
  topicTitle: string,
  post: { title: string; body: string }
): Promise<string> {
  const text = await aiClient.generateText({
    messages: [
      {
        role: "system",
        content:
          "あなたは文芸部の先輩だ。1作品のみを分析し、日本語で『あらすじ』『構成』『良かったところ』の3項目を必ず出力せよ。各項目は1-2文、プレーンテキストで返せ。文体は『だ・である』調に統一し、『です・ます』は禁止。",
      },
      {
        role: "user",
        content: [
          `お題: ${topicTitle}`,
          `作品タイトル: ${post.title}`,
          "本文:",
          post.body.slice(0, 1400),
          "",
          "次の形式で必ず出力:",
          "あらすじ: ...",
          "構成: ...",
          "良かったところ: ...",
        ].join("\n"),
      },
    ],
    max_tokens: 520,
    temperature: 0.25,
  });

  const compact = compactText(text, 900);
  if (!compact) {
    return "あらすじ: 主題への視線が一貫しており、作品の狙いが読み手に届く内容だ。 構成: 展開の切り替えが明確で、読み進める導線が整っている。 良かったところ: 語彙の選択に作者らしさがあり、印象の残る表現が複数見られる。";
  }
  return compact;
}

async function buildTopicOverviewFromStoredAnalyses(
  aiClient: ReturnType<typeof getAIClient>,
  topicTitle: string,
  postFeedback: Array<{ postId: string; title: string; praise: string }>
): Promise<string> {
  const input = postFeedback.map((item) => `・${item.title}: ${item.praise}`).join("\n");

  const text = await aiClient.generateText({
    messages: [
      {
        role: "system",
        content:
          "あなたは文芸部の先輩だ。複数作品の個別分析を読み、全体総評を日本語3文で作成せよ。改善提案は書かず、良かった点を中心にまとめること。文体は『だ・である』調に統一し、『です・ます』は禁止。",
      },
      {
        role: "user",
        content: `お題: ${topicTitle}\n個別分析一覧:\n${input}\n\n上記のみを根拠に総評を書け。`,
      },
    ],
    max_tokens: 420,
    temperature: 0.2,
  });

  return compactText(text, 320);
}

async function persistPerPostAnalysis(
  db: ReturnType<typeof getD1Client>,
  topicId: string,
  postFeedback: Array<{ postId: string; title: string; praise: string }>,
  nowMs: number
): Promise<void> {
  for (const item of postFeedback) {
    await db.execute({
      sql: `UPDATE posts
            SET aiAnalysis = ?, aiAnalysisUpdatedAt = ?, updatedAt = ?
            WHERE id = ? AND parentPostId = ?`,
      params: [
        item.praise,
        nowMs,
        nowMs,
        item.postId,
        topicId,
      ],
    });
  }
}

function hashInput(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function ensureAiAnalysisCacheTable(db: ReturnType<typeof getD1Client>) {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS aiAnalysisCache (
            id TEXT PRIMARY KEY,
            cacheKey TEXT NOT NULL UNIQUE,
            cacheType TEXT NOT NULL,
            targetId TEXT NOT NULL,
            inputHash TEXT NOT NULL,
            promptVersion TEXT NOT NULL,
            resultText TEXT NOT NULL,
            model TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            expiresAt INTEGER NOT NULL
          )`,
  });

  await db.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_aiAnalysisCache_lookup
          ON aiAnalysisCache(cacheType, targetId, inputHash, promptVersion, expiresAt)`,
  });

  await db.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_aiAnalysisCache_expiresAt
          ON aiAnalysisCache(expiresAt)`,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");

    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 });
    }

    const db = getD1Client();
    await ensureAiAnalysisCacheTable(db);
    const nowMs = Date.now();

    const latestCache = await db.execute<{ resultText: string }>({
      sql: `SELECT resultText
            FROM aiAnalysisCache
            WHERE cacheType = ?
              AND targetId = ?
              AND expiresAt > ?
            ORDER BY updatedAt DESC
            LIMIT 1`,
      params: ["topic_summary_latest", topicId, nowMs],
    });

    const cachedText = String(latestCache.results?.[0]?.resultText || "");
    if (!latestCache.success || !cachedText) {
      return NextResponse.json({ topicId, analysis: null, cached: false });
    }

    const parsed = safeJsonParse<AnalysisResponse>(cachedText);
    if (!parsed) {
      return NextResponse.json({ topicId, analysis: null, cached: false });
    }

    return NextResponse.json({
      topicId,
      analysis: normalizeAnalysisResponse(parsed),
      cached: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { topicId, forceRefresh } = await request.json();

    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 });
    }

    const db = getD1Client();
    await ensureAiAnalysisCacheTable(db);
    const postsResult = await db.getPosts();

    if (!postsResult.success || !postsResult.results) {
      return NextResponse.json({ error: postsResult.error || "Failed to load posts" }, { status: 500 });
    }

    const allPosts = postsResult.results as any[];
    const topic = allPosts.find((p) => p.id === topicId && p.isTopicPost === 1);

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const replies = allPosts
      .filter((p) => p.parentPostId === topicId)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (replies.length === 0) {
      return NextResponse.json({ error: "No replies yet for analysis" }, { status: 400 });
    }

    const replyAuthorEmails = Array.from(
      new Set(
        replies
          .map((reply) => String(reply.authorEmail || "").trim())
          .filter((email) => email.length > 0)
      )
    );

    const blockedAuthorEmails = new Set<string>();
    if (replyAuthorEmails.length > 0) {
      const placeholders = replyAuthorEmails.map(() => "?").join(",");
      const profileResult = await db.execute<any>({
        sql: `SELECT email, allowAiRead FROM userProfiles WHERE email IN (${placeholders})`,
        params: replyAuthorEmails,
      });

      if (profileResult.success && Array.isArray(profileResult.results)) {
        profileResult.results.forEach((row: any) => {
          if (Number(row?.allowAiRead ?? 1) === 0 && row?.email) {
            blockedAuthorEmails.add(String(row.email));
          }
        });
      }
    }

    const filteredReplies = replies.filter((reply) => {
      if (!reply.authorEmail) return true;
      return !blockedAuthorEmails.has(String(reply.authorEmail));
    });

    if (filteredReplies.length === 0) {
      return NextResponse.json({ error: "AI利用許可のある投稿がないため分析できません" }, { status: 400 });
    }

    const payload = {
      topic: {
        id: topic.id,
        title: topic.title,
        body: topic.body,
        deadline: topic.deadline || null,
      },
      replies: filteredReplies.map((r) => ({
        id: r.id,
        title: r.title,
        body: String(r.body || "").slice(0, 1200),
        author: r.author,
        authorEmail: r.authorEmail || null,
        createdAt: r.createdAt,
      })),
    };

    const inputHash = hashInput(JSON.stringify(payload));
    const cacheKey = `topic_summary:${topicId}:${inputHash}:v2`;
    const nowMs = Date.now();

    const cachedResult = await db.execute<{ resultText: string }>({
      sql: `SELECT resultText
            FROM aiAnalysisCache
            WHERE cacheKey = ?
              AND expiresAt > ?
            LIMIT 1`,
      params: [cacheKey, nowMs],
    });

    const cachedText = String(cachedResult.results?.[0]?.resultText || "");
    if (!forceRefresh && cachedResult.success && cachedText) {
      const cachedParsed = safeJsonParse<AnalysisResponse>(cachedText);
      if (cachedParsed) {
        return NextResponse.json(normalizeAnalysisResponse(cachedParsed));
      }
    }

    const aiClient = getAIClient();

    const postFeedback: AnalysisResponse["postFeedback"] = [];
    for (const reply of payload.replies) {
      const sourceReply = filteredReplies.find((item) => item.id === reply.id);
      const existingAnalysis = sourceReply ? extractStoredPostAnalysisText((sourceReply as any).aiAnalysis) : "";

      let analysisText = existingAnalysis;
      if (forceRefresh || !analysisText) {
        const rawAnalysis = await aiClient.generateIndividualAnalysis(reply.title, reply.body, topic.title);
        analysisText = compactText(rawAnalysis, 900);
      }

      postFeedback.push({
        postId: reply.id,
        title: reply.title,
        praise: analysisText,
      });
    }

    const overviewText = await buildTopicOverviewFromStoredAnalyses(aiClient, topic.title, postFeedback);

    const strictNormalized = enforcePerReplyFeedback(
      normalizeAnalysisResponse({
        overview:
          overviewText ||
          `${topic.title} をテーマにした投稿 ${postFeedback.length} 件の個別分析を踏まえ、作者ごとの視点の違いと表現の幅が印象的だった。`,
        strengths: [
          "お題に対する解釈が投稿ごとに分化し、読み味の差が明確",
          "語り口と語彙選択に、作者の個性が継続して表れている",
        ],
        suggestions: [
          "同一題材内での文体の振れ幅が、今後も興味深く広がる余地がある",
          "情景描写と内面描写のバランスに作者ごとの傾向が見える",
        ],
        postFeedback,
      }),
      payload.replies
    );

    await persistPerPostAnalysis(db, topicId, strictNormalized.postFeedback, nowMs);

    await db.execute({
      sql: `INSERT INTO aiAnalysisCache (
              id,
              cacheKey,
              cacheType,
              targetId,
              inputHash,
              promptVersion,
              resultText,
              model,
              createdAt,
              updatedAt,
              expiresAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cacheKey) DO UPDATE SET
              resultText = excluded.resultText,
              updatedAt = excluded.updatedAt,
              expiresAt = excluded.expiresAt`,
      params: [
        cacheKey,
        cacheKey,
        "topic_summary",
        topicId,
        inputHash,
        "v2",
        JSON.stringify(strictNormalized),
        "@cf/meta/llama-3.1-8b-instruct",
        nowMs,
        nowMs,
        nowMs + 7 * 24 * 60 * 60 * 1000,
      ],
    });

    const latestCacheKey = `topic_summary_latest:${topicId}`;
    await db.execute({
      sql: `INSERT INTO aiAnalysisCache (
              id,
              cacheKey,
              cacheType,
              targetId,
              inputHash,
              promptVersion,
              resultText,
              model,
              createdAt,
              updatedAt,
              expiresAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cacheKey) DO UPDATE SET
              resultText = excluded.resultText,
              inputHash = excluded.inputHash,
              updatedAt = excluded.updatedAt,
              expiresAt = excluded.expiresAt`,
      params: [
        latestCacheKey,
        latestCacheKey,
        "topic_summary_latest",
        topicId,
        inputHash,
        "v2",
        JSON.stringify(strictNormalized),
        "@cf/meta/llama-3.1-8b-instruct",
        nowMs,
        nowMs,
        nowMs + 365 * 24 * 60 * 60 * 1000,
      ],
    });

    return NextResponse.json(strictNormalized);
  } catch (error: any) {
    console.error("analysis api error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
