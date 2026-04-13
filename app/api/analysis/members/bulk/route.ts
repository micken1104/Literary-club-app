import { NextResponse } from "next/server";
import { getD1Client } from "@/app/lib/db";
import { getMemberPosts } from "@/app/lib/r2Utils";
import {
  generateMemberAnalysisWithCache,
  generateMemberTagsWithCache,
} from "@/app/lib/aiReviewService";

const MEMBER_SUMMARY_MAX_LENGTH = 120;
const EMPTY_POSTS_ANALYSIS = "まだ投稿データが少ないため、AI分析はこれから表示されます。";

export async function POST() {
  try {
    const db = getD1Client();

    let profilesResult = await db.execute<{ email: string; penName: string; aiUpdatedAt?: number; allowAiRead?: number }>({
      sql: `SELECT candidates.email,
                   up.penName,
                   up.aiUpdatedAt,
                   COALESCE(up.allowAiRead, 1) AS allowAiRead
            FROM (
              SELECT email FROM userProfiles
              UNION
              SELECT DISTINCT authorEmail AS email
              FROM posts
              WHERE authorEmail IS NOT NULL AND TRIM(authorEmail) <> ''
            ) AS candidates
            LEFT JOIN userProfiles up ON up.email = candidates.email
            ORDER BY COALESCE(up.updatedAt, 0) DESC, candidates.email ASC`,
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
          const nowSec = Math.floor(Date.now() / 1000);
          const fallbackTagsJson = JSON.stringify(["#投稿準備中", "#文芸部", "#部員紹介"]);

          let saveResult = await db.execute({
            sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead, createdAt, updatedAt)
                  VALUES (?, ?, NULL, '', ?, ?, ?, 1, strftime('%s', 'now'), strftime('%s', 'now'))
                  ON CONFLICT(email) DO UPDATE SET
                    penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                    aiSummary = excluded.aiSummary,
                    aiTagsJson = excluded.aiTagsJson,
                    aiUpdatedAt = excluded.aiUpdatedAt,
                    updatedAt = strftime('%s', 'now')`,
            params: [email, penName, EMPTY_POSTS_ANALYSIS, fallbackTagsJson, nowSec],
          });

          if (!saveResult.success) {
            saveResult = await db.execute({
              sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, createdAt, updatedAt)
                    VALUES (?, ?, NULL, '', ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
                    ON CONFLICT(email) DO UPDATE SET
                      penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                      aiSummary = excluded.aiSummary,
                      aiTagsJson = excluded.aiTagsJson,
                      aiUpdatedAt = excluded.aiUpdatedAt,
                      updatedAt = strftime('%s', 'now')`,
              params: [email, penName, EMPTY_POSTS_ANALYSIS, fallbackTagsJson, nowSec],
            });
          }

          if (saveResult.success) {
            successCount++;
          } else {
            errors.push({
              email,
              error: String(saveResult.error || "Failed to save empty-post analysis"),
            });
            errorCount++;
          }
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

        const tagsResult = await generateMemberTagsWithCache(db, {
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

        const finalTags = tagsResult.tags;
        const tagsJson = JSON.stringify(finalTags);
        const summary = String(result.text).replace(/\s+/g, " ").trim().slice(0, MEMBER_SUMMARY_MAX_LENGTH);
        const nowSec = Math.floor(Date.now() / 1000);

        let saveResult = await db.execute({
          sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, allowAiRead, createdAt, updatedAt)
                VALUES (?, ?, NULL, '', ?, ?, ?, 1, strftime('%s', 'now'), strftime('%s', 'now'))
                ON CONFLICT(email) DO UPDATE SET
                  penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                  aiSummary = excluded.aiSummary,
                  aiTagsJson = excluded.aiTagsJson,
                  aiUpdatedAt = excluded.aiUpdatedAt,
                  updatedAt = strftime('%s', 'now')`,
          params: [email, penName, summary, tagsJson, nowSec],
        });

        if (!saveResult.success) {
          saveResult = await db.execute({
            sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, createdAt, updatedAt)
                  VALUES (?, ?, NULL, '', ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
                  ON CONFLICT(email) DO UPDATE SET
                    penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                    aiSummary = excluded.aiSummary,
                    aiTagsJson = excluded.aiTagsJson,
                    aiUpdatedAt = excluded.aiUpdatedAt,
                    updatedAt = strftime('%s', 'now')`,
            params: [email, penName, summary, tagsJson, nowSec],
          });
        }

        if (!saveResult.success) {
          errors.push({
            email,
            error: String(saveResult.error || "Failed to save aiSummary"),
          });
          errorCount++;
          continue;
        }

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
