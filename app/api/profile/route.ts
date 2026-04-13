import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ensureDefaultUserIcon } from "@/app/lib/defaultIcon";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

type ProfileAiResult = {
  summary: string;
  hashtags: string[];
};

type QueryResult = {
  ok: boolean;
  results: any[];
  error?: string;
};

async function d1Query(url: string, sql: string, params: any[]): Promise<QueryResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, results: [], error: text || response.statusText };
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, results: [], error: "Invalid D1 JSON response" };
  }

  if (data?.success === false || data?.result?.[0]?.success === false) {
    return {
      ok: false,
      results: [],
      error: data?.errors?.[0]?.message || data?.result?.[0]?.error || "D1 query failed",
    };
  }

  return { ok: true, results: data?.result?.[0]?.results || [] };
}

function normalizeHashtags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter((tag) => tag.length > 0)
    .slice(0, 3);

  while (cleaned.length < 3) {
    cleaned.push("文芸部");
  }

  return cleaned.map((tag) => `#${tag.slice(0, 12)}`);
}

function fallbackProfileAnalysisFromPosts(): ProfileAiResult {
  return {
    summary: "過去投稿をもとにしたAI分析は準備中です。投稿が増えると表示が育ちます。",
    hashtags: normalizeHashtags(["投稿分析準備中", "文芸部", "創作ログ"]),
  };
}

async function buildPostsBasedAnalysisSkeleton(email: string, url: string): Promise<ProfileAiResult> {
  try {
    const postRes = await d1Query(
      url,
      "SELECT tag, title FROM posts WHERE authorEmail = ? ORDER BY createdAt DESC LIMIT 60",
      [email]
    );

    if (!postRes.ok) {
      return fallbackProfileAnalysisFromPosts();
    }

    const rows = postRes.results;

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        summary: "まだ投稿データが少ないため、AI分析はこれから表示されます。",
        hashtags: normalizeHashtags(["初投稿待ち", "文芸部", "これから"]),
      };
    }

    const tagCounts: Record<string, number> = {};
    rows.forEach((row: any) => {
      const tag = String(row?.tag || "創作").trim() || "創作";
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const topTag = sortedTags[0] || "創作";
    return {
      summary: `過去${rows.length}件の投稿では「${topTag}」の比率が高め。AI本実装時に文体と得意領域を詳しく分析します。`,
      hashtags: normalizeHashtags([topTag, "投稿傾向", "文芸部"]),
    };
  } catch {
    return fallbackProfileAnalysisFromPosts();
  }
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
    let result = await d1Query(
      url,
      "SELECT penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead FROM userProfiles WHERE email = ?",
      [session.user.email]
    );

    if (!result.ok) {
      // Backward compatibility for schema before allowAiRead column
      result = await d1Query(
        url,
        "SELECT penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt FROM userProfiles WHERE email = ?",
        [session.user.email]
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: "userProfiles schema is not migrated. Run latest migrations first." },
          { status: 500 }
        );
      }
    }

    const profile = result.results[0] || null;
    const aiTags = profile?.aiTagsJson ? JSON.parse(profile.aiTagsJson) : [];
    let userIcon = profile?.userIcon || null;

    if (!userIcon && session.user.email) {
      const defaultUserIcon = await ensureDefaultUserIcon(session.user.email);
      if (defaultUserIcon) {
        userIcon = defaultUserIcon;

        await d1Query(
          url,
          "UPDATE userProfiles SET userIcon = ?, updatedAt = strftime('%s', 'now') WHERE email = ?",
          [defaultUserIcon, session.user.email]
        );
      }
    }

    return NextResponse.json({
      penName: profile?.penName || null,
      userIcon,
      selfIntro: profile?.selfIntro || "",
      aiSummary: profile?.aiSummary || "",
      aiTags: Array.isArray(aiTags) ? aiTags : [],
      aiUpdatedAt: profile?.aiUpdatedAt || null,
      allowAiRead: profile?.allowAiRead === 0 ? false : true,
      email: session.user.email,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { penName, userIcon, selfIntro, refreshAi, allowAiRead } = await request.json();
    const hasPenName = penName !== undefined && penName !== null;
    const hasUserIcon = userIcon !== undefined;
    const hasSelfIntro = selfIntro !== undefined;
    const hasAllowAiRead = allowAiRead !== undefined;

    if (!hasPenName && !hasUserIcon && !hasSelfIntro && !hasAllowAiRead) {
      return NextResponse.json({ error: "更新するデータがありません" }, { status: 400 });
    }

    if (hasAllowAiRead && typeof allowAiRead !== "boolean") {
      return NextResponse.json({ error: "allowAiRead は boolean で指定してください" }, { status: 400 });
    }

    if (hasPenName) {
      if (typeof penName !== "string" || penName.trim().length === 0) {
        return NextResponse.json({ error: "ペンネームを入力してください" }, { status: 400 });
      }
      if (penName.trim().length > 20) {
        return NextResponse.json({ error: "ペンネームは20文字以内にしてください" }, { status: 400 });
      }
    }

    if (hasSelfIntro) {
      if (typeof selfIntro !== "string") {
        return NextResponse.json({ error: "自己紹介の形式が不正です" }, { status: 400 });
      }
      if (selfIntro.trim().length > 20) {
        return NextResponse.json({ error: "自己紹介は20文字以内にしてください" }, { status: 400 });
      }
    }

    if (hasUserIcon && userIcon !== null) {
      if (typeof userIcon !== "string") {
        return NextResponse.json({ error: "アイコンURLの形式が不正です" }, { status: 400 });
      }
      if (userIcon.length > 1000) {
        return NextResponse.json({ error: "アイコンURLが長すぎます" }, { status: 400 });
      }
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
    let currentRes = await d1Query(
      url,
      "SELECT penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead FROM userProfiles WHERE email = ?",
      [session.user.email]
    );

    if (!currentRes.ok) {
      // Backward compatibility for schema before allowAiRead column
      currentRes = await d1Query(
        url,
        "SELECT penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt FROM userProfiles WHERE email = ?",
        [session.user.email]
      );

      if (!currentRes.ok) {
        return NextResponse.json(
          { error: "userProfiles schema is not migrated. Run latest migrations first." },
          { status: 500 }
        );
      }
    }

    const current = currentRes.results[0] || null;
    const finalPenName = hasPenName
      ? String(penName).trim()
      : (current?.penName || session.user.name || "匿名部員");
    let finalUserIcon = hasUserIcon ? (userIcon || null) : (current?.userIcon || null);
    if (!finalUserIcon) {
      finalUserIcon = await ensureDefaultUserIcon(session.user.email);
    }
    const finalSelfIntro = hasSelfIntro ? String(selfIntro || "").trim() : (current?.selfIntro || "");
    const finalAllowAiRead = hasAllowAiRead
      ? (allowAiRead ? 1 : 0)
      : (current?.allowAiRead === 0 ? 0 : 1);

    const nowSec = Math.floor(Date.now() / 1000);
    const currentAiUpdatedAt = Number(current?.aiUpdatedAt || 0);
    const refreshIntervalSec = 60 * 60 * 24 * 14;
    const shouldRefreshAi =
      refreshAi === true ||
      !current?.aiSummary ||
      !currentAiUpdatedAt ||
      nowSec - currentAiUpdatedAt > refreshIntervalSec;

    const aiGenerated = shouldRefreshAi && finalAllowAiRead === 1
      ? await buildPostsBasedAnalysisSkeleton(session.user.email, url)
      : null;

    const finalAiSummary = aiGenerated
      ? aiGenerated.summary
      : (current?.aiSummary || fallbackProfileAnalysisFromPosts().summary);

    const finalAiTags = aiGenerated
      ? aiGenerated.hashtags
      : (current?.aiTagsJson
          ? JSON.parse(current.aiTagsJson)
          : fallbackProfileAnalysisFromPosts().hashtags);

    const finalAiUpdatedAt = shouldRefreshAi ? nowSec : (currentAiUpdatedAt || nowSec);

    let saveRes = await d1Query(
      url,
      `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
       ON CONFLICT(email) DO UPDATE SET
         penName = ?,
         userIcon = ?,
         selfIntro = ?,
         aiSummary = ?,
         aiTagsJson = ?,
         aiUpdatedAt = ?,
         allowAiRead = ?,
         updatedAt = strftime('%s', 'now')`,
      [
        session.user.email,
        finalPenName,
        finalUserIcon,
        finalSelfIntro,
        finalAiSummary,
        JSON.stringify(finalAiTags),
        finalAiUpdatedAt,
        finalAllowAiRead,
        finalPenName,
        finalUserIcon,
        finalSelfIntro,
        finalAiSummary,
        JSON.stringify(finalAiTags),
        finalAiUpdatedAt,
        finalAllowAiRead,
      ]
    );

    if (!saveRes.ok && String(saveRes.error || "").toLowerCase().includes("allowairead")) {
      // Backward compatibility for schema before allowAiRead column
      saveRes = await d1Query(
        url,
        `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
         ON CONFLICT(email) DO UPDATE SET
           penName = ?,
           userIcon = ?,
           selfIntro = ?,
           aiSummary = ?,
           aiTagsJson = ?,
           aiUpdatedAt = ?,
           updatedAt = strftime('%s', 'now')`,
        [
          session.user.email,
          finalPenName,
          finalUserIcon,
          finalSelfIntro,
          finalAiSummary,
          JSON.stringify(finalAiTags),
          finalAiUpdatedAt,
          finalPenName,
          finalUserIcon,
          finalSelfIntro,
          finalAiSummary,
          JSON.stringify(finalAiTags),
          finalAiUpdatedAt,
        ]
      );
    }

    if (!saveRes.ok) {
      return NextResponse.json({ error: saveRes.error || "Failed to save profile" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      penName: finalPenName,
      userIcon: finalUserIcon,
      selfIntro: finalSelfIntro,
      aiSummary: finalAiSummary,
      aiTags: finalAiTags,
      aiUpdatedAt: finalAiUpdatedAt,
      allowAiRead: finalAllowAiRead === 1,
    });
  } catch (error) {
    console.error("Profile POST error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
