import { createHash } from "node:crypto";
import type { D1Client } from "@/app/lib/db";
import { getAIClient } from "@/app/lib/ai";
import { getTextFromR2 } from "@/app/lib/r2Utils";

type CacheType = "post_review" | "weekly_summary" | "member_profile";

type CacheRecord = {
  resultText: string;
  createdAt: number;
};

type WeeklyAggregateInput = {
  totalPosts: number;
  themes: string[];
  commonKeywords: string[];
  topPostMentions: string[];
};

type MemberPost = {
  title: string;
  body: string;
  tag: string;
};

type GeneratePostReviewParams = {
  postId: string;
  title: string;
  tag: string;
  body?: string;
  r2Key?: string;
  forceRefresh?: boolean;
};

type GenerateWeeklySummaryParams = {
  cacheKey: string;
  aggregate: WeeklyAggregateInput;
  forceRefresh?: boolean;
};

type GenerateMemberAnalysisParams = {
  memberKey: string;
  penName: string;
  posts: MemberPost[];
  forceRefresh?: boolean;
};

type CachedResult = {
  text: string;
  fromCache: boolean;
};

const CACHE_PROMPT_VERSION = "v1";
const MODEL_NAME = "@cf/meta/llama-3-8b-instruct";

const POST_BODY_LIMIT = 3000;
const MEMBER_POST_BODY_LIMIT = 1000;
const MEMBER_POST_LIMIT = 10;
const MEMBER_SHORT_INTRO_MAX = 20;

const POST_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const WEEKLY_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MEMBER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  "こと",
  "もの",
  "ため",
  "これ",
  "それ",
  "あれ",
  "よう",
  "さん",
  "ます",
  "です",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "なる",
  "から",
  "まで",
  "とか",
  "でも",
  "そして",
  "しかし",
  "また",
  "ように",
]);

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function toSingleSentence(text: string): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.+?[。.!?！？]/);
  const baseSentence = match && match[0] ? match[0].trim() : normalized;
  const plain = baseSentence.replace(/[。.!?！？]+$/g, "").trim();
  if (!plain) return "";
  if (plain.length <= MEMBER_SHORT_INTRO_MAX) {
    return `${plain}。`;
  }
  return `${plain.slice(0, MEMBER_SHORT_INTRO_MAX).trim()}。`;
}

function hashInput(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function extractKeywords(posts: Array<{ body: string }>, limit: number): string[] {
  const wordCount = new Map<string, number>();

  posts.forEach((post) => {
    const words = post.body.match(/[一-龠々ぁ-ゖァ-ヺー]{2,}|[a-zA-Z]{3,}/g) ?? [];
    words.forEach((word) => {
      const normalized = word.toLowerCase();
      if (STOPWORDS.has(normalized)) {
        return;
      }
      wordCount.set(normalized, (wordCount.get(normalized) ?? 0) + 1);
    });
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function normalizeR2TextContent(content: string): string {
  const segments = content.split("\n---\n");
  if (segments.length >= 2) {
    return segments.slice(1).join("\n---\n").trim();
  }
  return content.trim();
}

async function getCache(
  db: D1Client,
  cacheType: CacheType,
  targetId: string,
  inputHash: string,
  ttlMs: number
): Promise<CacheRecord | null> {
  const now = Date.now();
  const result = await db.execute<{ resultText: string; createdAt: number }>({
    sql: `
      SELECT resultText, createdAt
      FROM aiAnalysisCache
      WHERE cacheType = ?
        AND targetId = ?
        AND inputHash = ?
        AND promptVersion = ?
        AND expiresAt > ?
      ORDER BY createdAt DESC
      LIMIT 1
    `,
    params: [cacheType, targetId, inputHash, CACHE_PROMPT_VERSION, now],
  });

  if (!result.success || !result.results || result.results.length === 0) {
    return null;
  }

  const row = result.results[0];
  if (!row) {
    return null;
  }

  if (now - Number(row.createdAt) > ttlMs) {
    return null;
  }

  return {
    resultText: String(row.resultText ?? ""),
    createdAt: Number(row.createdAt ?? now),
  };
}

async function upsertCache(
  db: D1Client,
  cacheType: CacheType,
  targetId: string,
  inputHash: string,
  resultText: string,
  ttlMs: number
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const cacheKey = `${cacheType}:${targetId}:${inputHash}:${CACHE_PROMPT_VERSION}`;

  await db.execute({
    sql: `
      INSERT INTO aiAnalysisCache (
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
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cacheKey) DO UPDATE SET
        resultText = excluded.resultText,
        model = excluded.model,
        updatedAt = excluded.updatedAt,
        expiresAt = excluded.expiresAt
    `,
    params: [
      cacheKey,
      cacheKey,
      cacheType,
      targetId,
      inputHash,
      CACHE_PROMPT_VERSION,
      resultText,
      MODEL_NAME,
      now,
      now,
      expiresAt,
    ],
  });
}

async function resolvePostBody(params: GeneratePostReviewParams): Promise<string> {
  if (params.body && params.body.trim().length > 0) {
    return clampText(params.body.trim(), POST_BODY_LIMIT);
  }

  if (params.r2Key && params.r2Key.trim().length > 0) {
    const content = await getTextFromR2(params.r2Key.trim());
    return clampText(normalizeR2TextContent(content), POST_BODY_LIMIT);
  }

  throw new Error("body or r2Key is required");
}

export async function generatePostReviewWithCache(
  db: D1Client,
  params: GeneratePostReviewParams
): Promise<CachedResult> {
  const body = await resolvePostBody(params);
  const normalizedTag = params.tag || "創作";
  const inputHash = hashInput(
    JSON.stringify({ title: params.title, body, tag: normalizedTag })
  );

  if (!params.forceRefresh) {
    const cached = await getCache(
      db,
      "post_review",
      params.postId,
      inputHash,
      POST_CACHE_TTL_MS
    );
    if (cached) {
      return { text: cached.resultText, fromCache: true };
    }
  }

  const ai = getAIClient();
  const text = await ai.generatePostReview(params.title, body);

  await upsertCache(
    db,
    "post_review",
    params.postId,
    inputHash,
    text,
    POST_CACHE_TTL_MS
  );

  return { text, fromCache: false };
}

export async function generateWeeklySummaryWithCache(
  db: D1Client,
  params: GenerateWeeklySummaryParams
): Promise<CachedResult> {
  const inputHash = hashInput(JSON.stringify(params.aggregate));

  if (!params.forceRefresh) {
    const cached = await getCache(
      db,
      "weekly_summary",
      params.cacheKey,
      inputHash,
      WEEKLY_CACHE_TTL_MS
    );
    if (cached) {
      return { text: cached.resultText, fromCache: true };
    }
  }

  const ai = getAIClient();
  const text = await ai.generateWeeklySummary(params.aggregate);

  await upsertCache(
    db,
    "weekly_summary",
    params.cacheKey,
    inputHash,
    text,
    WEEKLY_CACHE_TTL_MS
  );

  return { text, fromCache: false };
}

export async function generateMemberAnalysisWithCache(
  db: D1Client,
  params: GenerateMemberAnalysisParams
): Promise<CachedResult> {
  const normalizedPosts = params.posts
    .slice(0, MEMBER_POST_LIMIT)
    .map((post) => ({
      title: post.title,
      body: clampText(post.body, MEMBER_POST_BODY_LIMIT),
      tag: post.tag || "一般",
    }));

  const inputHash = hashInput(
    JSON.stringify({ penName: params.penName, posts: normalizedPosts })
  );

  if (!params.forceRefresh) {
    const cached = await getCache(
      db,
      "member_profile",
      params.memberKey,
      inputHash,
      MEMBER_CACHE_TTL_MS
    );
    if (cached && cached.resultText && cached.resultText.trim().length > 0) {
      console.log(`✅ Member analysis cache hit: ${params.penName}`);
      return { text: cached.resultText, fromCache: true };
    }
  }

  const ai = getAIClient();
  console.log(`🔍 Generating member analysis: ${params.penName} with ${normalizedPosts.length} posts`);
  const text = await ai.analyzeMemberProfile(params.penName, normalizedPosts);
  const singleSentenceText = toSingleSentence(text);

  if (!singleSentenceText || singleSentenceText.trim().length === 0) {
    console.error(`❌ AI analysis returned empty for ${params.penName}`);
    return {
      text: `${params.penName}さんの文体特性を現在分析中です。`,
      fromCache: false,
    };
  }

  console.log(`✅ Generated analysis: ${singleSentenceText.slice(0, 50)}...`);

  try {
    await upsertCache(
      db,
      "member_profile",
      params.memberKey,
      inputHash,
      singleSentenceText,
      MEMBER_CACHE_TTL_MS
    );
  } catch (e) {
    console.error(`⚠️ Cache storage failed for ${params.penName}:`, e);
  }

  return { text: singleSentenceText, fromCache: false };
}

export function buildWeeklyAggregate(posts: Array<{ title: string; body: string; tag?: string }>): WeeklyAggregateInput {
  const themes = Array.from(
    new Set(posts.map((post) => post.tag?.trim()).filter(Boolean))
  ) as string[];

  return {
    totalPosts: posts.length,
    themes: themes.length > 0 ? themes : ["創作"],
    commonKeywords: extractKeywords(posts, 6),
    topPostMentions: posts.slice(0, 3).map((post) => `『${post.title}』`),
  };
}
