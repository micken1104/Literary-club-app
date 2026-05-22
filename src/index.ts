type D1Result<T> = {
  results?: T[];
  success?: boolean;
  error?: string;
};

type D1BoundStatement = {
  bind(...values: Array<string | number | null>): {
    all<T>(): Promise<D1Result<T>>;
    run(): Promise<{ success: boolean; error?: string }>;
  };
};

type D1Database = {
  prepare(sql: string): D1BoundStatement;
};

type ScheduledEvent = {
  scheduledTime: number;
  cron: string;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = {
  DB: D1Database;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_API_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

type PostRow = {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: number;
  updatedAt: number;
  aiHashtagsJson: string | null;
  aiHashtagsUpdatedAt: number | null;
};

type MemberProfileRow = {
  email: string;
  penName: string;
  aiUpdatedAt: number | null;
  allowAiRead: number | null;
};

type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AIResponse = {
  result?: {
    response?: string;
  };
  success?: boolean;
  errors?: Array<{ message?: string; code?: number }>;
};

type AllowedTag = (typeof TAG_POOL)[number];

const MODEL_NAME = "@cf/meta/llama-3.1-8b-instruct";
const MAX_POSTS_PER_RUN = 50;
const MAX_BODY_LENGTH = 2400;

const TAG_POOL = [
  "#純文学",
  "#エンタメ",
  "#情景描写",
  "#比喩",
  "#心理描写",
  "#叙情的",
  "#難解",
  "#軽妙",
  "#伝統的",
  "#前衛적",
  "#口語体",
  "#文語体",
  "#一人称",
  "#三人称",
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
] as const;

const MEMBER_HASHTAG_POOL = [
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

const MEMBER_HASHTAG_SET = new Set<string>(MEMBER_HASHTAG_POOL);
const MEMBER_MODEL_NAME = "@cf/meta/llama-3.1-8b-instruct";
const MAX_MEMBER_POSTS_PER_RUN = 50;
const MEMBER_POST_LIMIT = 10;
const MEMBER_POST_BODY_LENGTH = 1200;
const MEMBER_REFRESH_THRESHOLD_SEC = 6 * 24 * 60 * 60;

const TAG_KEYWORDS: Record<AllowedTag, string[]> = {
  "#純文学": ["内省", "余韻", "静か", "繊細", "孤独", "心象", "文学"],
  "#エンタメ": ["展開", "事件", "テンポ", "冒険", "娯楽", "活劇", "見せ場"],
  "#情景描写": ["風景", "空", "光", "音", "季節", "景色", "街"],
  "#比喩": ["ような", "みたい", "比喩", "象徴", "重ね", "たとえ"],
  "#心理描写": ["葛藤", "感情", "不安", "迷い", "内面", "心", "気持ち"],
  "#叙情的": ["叙情", "余韻", "詩", "情緒", "やわらか", "しみじみ", "詩的"],
  "#難解": ["抽象", "難解", "断片", "曖昧", "飛躍", "複雑", "謎"],
  "#軽妙": ["軽快", "軽妙", "ユーモア", "会話", "洒脱", "明るい", "軽やか"],
  "#伝統的": ["古典", "俳句", "和歌", "文語", "古風", "格式", "伝統"],
  "#前衛적": ["前衛", "実験", "断片", "破壊", "非線形", "コラージュ", "実験的"],
  "#口語体": ["口語", "会話", "話し言葉", "くだけ", "自然", "ラフ"],
  "#文語体": ["文語", "古語", "である", "格調", "古風", "雅"],
  "#一人称": ["私", "僕", "俺", "わたし", "一人称", "自分"],
  "#三人称": ["彼", "彼女", "彼ら", "三人称", "人物", "視点"],
  "#青春": ["青春", "部活", "夏", "恋", "成長", "若さ", "学校"],
  "#幻想的": ["夢", "幻", "霧", "月", "不思議", "幻想", "異世界"],
  "#写実的": ["現実", "具体", "観察", "描写", "写実", "生活", "細部"],
  "#耽美": ["耽美", "美", "艶", "優美", "装飾", "官能", "華麗"],
  "#退廃的": ["退廃", "荒廃", "腐敗", "終末", "壊れ", "暗い", "崩壊"],
  "#日常": ["日常", "暮らし", "通学", "食卓", "買い物", "平凡", "生活"],
  "#シュール": ["シュール", "奇妙", "唐突", "ナンセンス", "不思議", "奇抜"],
  "#哲学的": ["存在", "意味", "問い", "哲学", "真理", "思索", "本質"],
  "#ノスタルジー": ["懐か", "記憶", "過去", "昔", "追憶", "郷愁", "ノスタルジー"],
  "#不条理": ["不条理", "理不尽", "矛盾", "唐突", "不可解", "意味不明"],
  "#諷刺": ["皮肉", "諷刺", "風刺", "批判", "アイロニー", "社会", "揶揄"],
};

const SYSTEM_PROMPT = [
  "あなたは文芸部作品の自動ハッシュタグ選定器である。",
  "目的は、作品本文の特徴を最もよく表すハッシュタグを、定義済みのタグプールからだけ3つ選ぶことである。",
  "出力規則は厳守せよ。",
  "- 出力は JSON 配列のみ。",
  "- 形式は [\"#タグ1\", \"#タグ2\", \"#タグ3\"] とする。",
  "- ちょうど3件を返す。重複は禁止。",
  "- タグプールに存在しない語を一切出力してはならない。",
  "- 説明文、前置き、Markdown、コードブロック、箇条書きは禁止。",
  "- 作品本文に確信が持てない場合でも、必ずタグプール内の最も近い3件を選ぶ。",
  `タグプール: ${TAG_POOL.join(", ")}`,
].join("\n");

function normalizeText(value: string): string {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

function clampText(value: string, maxLength: number): string {
  const normalized = normalizeText(value);
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function buildUserPrompt(post: PostRow): string {
  return [
    "以下の作品について、最適なハッシュタグを3つ選んでください。",
    "選択は必ずタグプールの中から行い、本文の特徴が重複なく伝わるようにしてください。",
    "作品タイトル:",
    post.title,
    "本文:",
    clampText(post.body, MAX_BODY_LENGTH),
    "既存の投稿カテゴリ:",
    post.tag || "未指定",
  ].join("\n");
}

function buildMemberTagPrompt(memberName: string, posts: Array<{ title: string; body?: string }>): string {
  const lines = posts
    .map((post, index) => {
      const body = String(post.body || "").slice(0, MEMBER_POST_BODY_LENGTH);
      return `作品${index + 1}: ${post.title}\n${body}`;
    })
    .join("\n\n");

  return [
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
    `作者: ${memberName}`,
    "",
    `対象作品:\n${lines}`,
  ].join("\n");
}

function normalizeMemberTagText(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function parseMemberTags(raw: string): string[] {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  const jsonText = cleaned.match(/\[[\s\S]*\]/)?.[0] ?? cleaned;

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tags: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }

      const normalized = normalizeMemberTagText(item);
      if (normalized && normalized.startsWith("#") && MEMBER_HASHTAG_SET.has(normalized) && !tags.includes(normalized)) {
        tags.push(normalized);
      }
    }

    return tags.slice(0, 3);
  } catch {
    return [];
  }
}

function fallbackMemberTags(posts: Array<{ title: string; body: string; tag: string }>): string[] {
  const candidateTags = posts
    .slice(0, 3)
    .map((post) => `#${String(post.tag || "創作").replace(/^#+/, "")}`)
    .filter((tag, index, tagsList) => tag.length > 1 && MEMBER_HASHTAG_SET.has(tag) && tagsList.indexOf(tag) === index);

  const fillers = ["#純文学", "#心理描写", "#日常", "#孤独", "#再生"];
  while (candidateTags.length < 3) {
    const next = fillers.find((tag) => !candidateTags.includes(tag));
    if (!next) {
      break;
    }
    candidateTags.push(next);
  }

  return candidateTags.slice(0, 3);
}

async function callMemberTagAI(env: Env, memberName: string, posts: Array<{ title: string; body?: string }>): Promise<string> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials are not configured.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MEMBER_MODEL_NAME}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: buildMemberTagPrompt(memberName, posts),
        },
        {
          role: "assistant",
          content: '["#叙情的", "#心理描写", "#ノスタルジー"]',
        },
        {
          role: "user",
          content: `作者: ${memberName}\n\n対象作品:\n${posts
            .map((post, index) => {
              const body = String(post.body || "").slice(0, MEMBER_POST_BODY_LENGTH);
              return `作品${index + 1}: ${post.title}\n${body}`;
            })
            .join("\n\n")}`,
        },
      ] satisfies AIMessage[],
      max_tokens: 120,
      temperature: 0.15,
      top_p: 0.2,
      repetition_penalty: 1.05,
      jsonMode: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AIResponse;
  const raw = String(data.result?.response || "").trim();
  if (!raw) {
    throw new Error("AI returned an empty response");
  }

  return raw;
}

function normalizeAllowedTag(value: string): AllowedTag | null {
  const trimmed = String(value || "").trim();
  return (TAG_POOL as readonly string[]).includes(trimmed) ? (trimmed as AllowedTag) : null;
}

function extractJsonArray(raw: string): string[] {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  const arrayText = cleaned.match(/\[[\s\S]*\]/)?.[0] ?? cleaned;

  try {
    const parsed = JSON.parse(arrayText);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tags: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }
      const tag = normalizeAllowedTag(item);
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags.slice(0, 3);
  } catch {
    return [];
  }
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (keyword && text.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

function fallbackTags(post: PostRow): AllowedTag[] {
  const combined = `${post.title}\n${post.body}`;
  const scored = TAG_POOL.map((tag) => [tag, countKeywordHits(combined, TAG_KEYWORDS[tag])] as const)
    .sort((left, right) => right[1] - left[1]);

  const chosen: AllowedTag[] = [];
  for (const [tag, score] of scored) {
    if (score <= 0 && chosen.length >= 3) {
      break;
    }
    if (!chosen.includes(tag)) {
      chosen.push(tag);
    }
    if (chosen.length === 3) {
      break;
    }
  }

  for (const tag of TAG_POOL) {
    if (chosen.length === 3) {
      break;
    }
    if (!chosen.includes(tag)) {
      chosen.push(tag);
    }
  }

  return chosen.slice(0, 3);
}

async function callWorkersAI(env: Env, post: PostRow): Promise<string> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials are not configured.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL_NAME}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(post) },
      ] satisfies AIMessage[],
      max_tokens: 220,
      temperature: 0,
      top_p: 0.1,
      repetition_penalty: 1.05,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AIResponse;
  const raw = String(data.result?.response || "").trim();
  if (!raw) {
    throw new Error("AI returned an empty response");
  }

  return raw;
}

function ensureThreeUniqueTags(tags: string[], post: PostRow): AllowedTag[] {
  const valid: AllowedTag[] = [];

  for (const tag of tags) {
    const normalized = normalizeAllowedTag(tag);
    if (normalized && !valid.includes(normalized)) {
      valid.push(normalized);
    }
  }

  if (valid.length < 3) {
    for (const fallbackTag of fallbackTags(post)) {
      if (!valid.includes(fallbackTag)) {
        valid.push(fallbackTag);
      }
      if (valid.length === 3) {
        break;
      }
    }
  }

  return valid.slice(0, 3);
}

async function updatePostHashtags(env: Env, post: PostRow, tags: AllowedTag[]): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE posts
     SET aiHashtagsJson = ?, aiHashtagsUpdatedAt = ?, updatedAt = ?
     WHERE id = ?`
  )
    .bind(JSON.stringify(tags), now, now, post.id)
    .run();
}

async function updateMemberTags(env: Env, profile: MemberProfileRow, tags: string[]): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead, createdAt, updatedAt)
     VALUES (?, ?, NULL, '', '', ?, ?, 1, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
       aiTagsJson = excluded.aiTagsJson,
       aiUpdatedAt = excluded.aiUpdatedAt,
       updatedAt = excluded.updatedAt`
  )
    .bind(profile.email, profile.penName, JSON.stringify(tags), nowSec, nowSec, nowSec)
    .run();
}

async function processPendingPosts(env: Env): Promise<{ processed: number; updated: number; failed: number }> {
  let processed = 0;
  let updated = 0;
  let failed = 0;
  const attemptedIds = new Set<string>();

  while (processed < MAX_POSTS_PER_RUN) {
    const remaining = MAX_POSTS_PER_RUN - processed;
    const fetchLimit = Math.min(remaining * 4, 200);
    const rows = await env.DB.prepare(
      `SELECT id,
              title,
              body,
              tag,
              createdAt,
              updatedAt,
              COALESCE(aiHashtagsJson, '') AS aiHashtagsJson,
              aiHashtagsUpdatedAt
       FROM posts
       WHERE isTopicPost != 1
         AND tag != 'お題案'
         AND (
           aiHashtagsJson IS NULL
           OR aiHashtagsJson = ''
           OR aiHashtagsUpdatedAt IS NULL
           OR aiHashtagsUpdatedAt < updatedAt
         )
       ORDER BY COALESCE(aiHashtagsUpdatedAt, 0) ASC, createdAt ASC
       LIMIT ?`
    )
      .bind(fetchLimit)
      .all<PostRow>();

    const posts = ((rows.results || []) as PostRow[]).filter((post) => !attemptedIds.has(post.id));
    if (posts.length === 0) {
      break;
    }

    for (const post of posts) {
      if (processed >= MAX_POSTS_PER_RUN) {
        break;
      }

      attemptedIds.add(post.id);
      processed += 1;

      try {
        const raw = await callWorkersAI(env, post);
        const parsed = extractJsonArray(raw);
        const tags = ensureThreeUniqueTags(parsed, post);

        await updatePostHashtags(env, post, tags);
        updated += 1;
      } catch (error) {
        const tags = fallbackTags(post);
        try {
          await updatePostHashtags(env, post, tags);
          updated += 1;
        } catch (fallbackError) {
          failed += 1;
          console.error("Failed to update post hashtags:", post.id, error, fallbackError);
        }
      }
    }

    if (posts.length < remaining) {
      break;
    }
  }

  return { processed, updated, failed };
}

async function refreshMemberTags(env: Env): Promise<{ processed: number; updated: number; failed: number }> {
  const threshold = Math.floor(Date.now() / 1000) - MEMBER_REFRESH_THRESHOLD_SEC;
  const rows = await env.DB.prepare(
    `SELECT candidates.email,
            COALESCE(up.penName, candidates.email) AS penName,
            COALESCE(up.aiUpdatedAt, 0) AS aiUpdatedAt,
            COALESCE(up.allowAiRead, 1) AS allowAiRead
     FROM (
       SELECT email FROM userProfiles
       UNION
       SELECT DISTINCT authorEmail AS email
       FROM posts
       WHERE authorEmail IS NOT NULL AND TRIM(authorEmail) <> ''
     ) AS candidates
     LEFT JOIN userProfiles up ON up.email = candidates.email
     WHERE COALESCE(up.allowAiRead, 1) = 1
       AND COALESCE(up.aiUpdatedAt, 0) < ?
     ORDER BY COALESCE(up.updatedAt, 0) DESC, candidates.email ASC
     LIMIT ?`
  )
    .bind(threshold, MAX_MEMBER_POSTS_PER_RUN)
    .all<MemberProfileRow>();

  const profiles = (rows.results || []) as MemberProfileRow[];
  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (processed >= MAX_MEMBER_POSTS_PER_RUN) {
      break;
    }

    processed += 1;

    try {
      const postsResult = await env.DB.prepare(
        `SELECT id, title, body, tag
         FROM posts
         WHERE authorEmail = ?
           AND isTopicPost = 0
         ORDER BY createdAt DESC
         LIMIT ?`
      )
        .bind(profile.email, MEMBER_POST_LIMIT)
        .all<{ id: string; title: string; body: string; tag: string }>();

      const posts = (postsResult.results || []) as Array<{ id: string; title: string; body: string; tag: string }>;
      if (posts.length === 0) {
        await updateMemberTags(env, profile, ["#投稿準備中", "#文芸部", "#部員紹介"]);
        updated += 1;
        continue;
      }

      const trimmedPosts = posts.map((post) => ({
        title: post.title,
        body: post.body.length > MEMBER_POST_BODY_LENGTH ? post.body.slice(0, MEMBER_POST_BODY_LENGTH) : post.body,
        tag: post.tag || "創作",
      }));

      const raw = await callMemberTagAI(env, profile.penName || profile.email.split("@")[0] || "部員", trimmedPosts);
      const parsed = parseMemberTags(raw);
      const tags = parsed.length === 3 ? parsed : fallbackMemberTags(trimmedPosts);

      await updateMemberTags(env, profile, tags);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to refresh member hashtags:", profile.email, error);
    }
  }

  return { processed, updated, failed };
}

async function runScheduledHashtagRefresh(env: Env): Promise<void> {
  const postSummary = await processPendingPosts(env);
  const memberSummary = await refreshMemberTags(env);
  console.log("Weekly refresh completed:", { postSummary, memberSummary });
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledHashtagRefresh(env));
  },
};
