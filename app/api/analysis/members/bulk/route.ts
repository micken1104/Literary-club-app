import { NextResponse } from "next/server";
import { getD1Client } from "@/app/lib/db";
import { getMemberPosts } from "@/app/lib/r2Utils";
import { generateMemberAnalysisWithCache } from "@/app/lib/aiReviewService";

export async function POST() {
  try {
    const db = getD1Client();

    let profilesResult = await db.execute<{ email: string; penName: string; aiUpdatedAt?: number; allowAiRead?: number }>({
      sql: `SELECT email, penName, aiUpdatedAt, allowAiRead
            FROM userProfiles
            ORDER BY updatedAt DESC`,
    });

    if (!profilesResult.success) {
      profilesResult = await db.execute<{ email: string; penName: string; aiUpdatedAt?: number; allowAiRead?: number }>({
        sql: `SELECT email, penName, aiUpdatedAt
              FROM userProfiles
              ORDER BY updatedAt DESC`,
      });
    }

    if (!profilesResult.success || !profilesResult.results) {
      return NextResponse.json(
        {
          error: "Failed to fetch user profiles",
          detail: String(profilesResult.error || "unknown"),
        },
        { status: 500 }
      );
    }

    const profiles = profilesResult.results;

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const profile of profiles) {
      try {
        const email = profile.email;
        const penName = profile.penName || email.split("@")[0];

        if (Number(profile.allowAiRead ?? 1) === 0) {
          skipCount++;
          continue;
        }

        const posts = await getMemberPosts(db, email, 15);

        if (!posts || posts.length === 0) {
          skipCount++;
          continue;
        }

        const result = await generateMemberAnalysisWithCache(db, {
          memberKey: email,
          penName,
          posts: posts.map((p) => ({
            title: p.title,
            body: p.body.length > 1000 ? p.body.substring(0, 1000) : p.body,
            tag: p.tag || "創作",
          })),
          forceRefresh: true,
        });

        if (!result.text) {
          errors.push({
            email,
            error: "AI analysis returned empty result",
          });
          errorCount++;
          continue;
        }

        const tagCounts: Record<string, number> = {};
        posts.forEach((p) => {
          const tag = String(p.tag || "創作").trim() || "創作";
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });

        const sortedTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag]) => tag);

        const finalTags = sortedTags.length > 0
          ? sortedTags.concat(["文芸部"]).slice(0, 3)
          : ["創作", "文芸部", "投稿傾向"];

        const tagsJson = JSON.stringify(finalTags.map((tag) => `#${tag.slice(0, 12)}`));
        const summary = String(result.text).replace(/\s+/g, " ").trim().slice(0, 500);
        const nowSec = Math.floor(Date.now() / 1000);

        await db.execute({
          sql: `UPDATE userProfiles
                SET aiSummary = ?,
                    aiTagsJson = ?,
                    aiUpdatedAt = ?,
                    updatedAt = strftime('%s', 'now')
                WHERE email = ?`,
          params: [summary, tagsJson, nowSec, email],
        });

        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push({
          email: profile.email,
          error: errorMsg,
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      status: "completed",
      timestamp: new Date().toISOString(),
      summary: {
        totalProfiles: profiles.length,
        successCount,
        skipCount,
        errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        status: "failed",
      },
      { status: 500 }
    );
  }
}
