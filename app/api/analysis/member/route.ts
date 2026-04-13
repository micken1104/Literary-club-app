/**
 * POST /api/analysis/member
 * 部員の文体・テーマ分析を生成
 * 
 * リクエスト:
 * {
 *   "email": "member@example.com",
 *   "penName": "ペンネーム",
 *   "posts": [
 *     { "id": "...", "title": "...", "body": "...", "tag": "..." },
 *     ...
 *   ]
 * }
 * または（DBから自動取得）:
 * {
 *   "email": "member@example.com",
 *   "penName": "ペンネーム",
 *   "autoFetch": true
 * }
 */

import { NextResponse, NextRequest } from "next/server";
import { getMemberPosts } from "@/app/lib/r2Utils";
import { getD1Client } from "@/app/lib/db";
import {
  generateMemberAnalysisWithCache,
  generateMemberTagsWithCache,
} from "@/app/lib/aiReviewService";

const MEMBER_SUMMARY_MAX_LENGTH = 120;
const EMPTY_POSTS_ANALYSIS = "まだ投稿データが少ないため、AI分析はこれから表示されます。";
const MEMBER_ANALYSIS_VERSION = "v2-tags-pool";

interface MemberAnalysisRequest {
  email?: string;
  penName: string;
  posts?: Array<{ title: string; body: string; tag: string }>;
  autoFetch?: boolean;
  limit?: number;
  forceRefresh?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    console.log(`🚀 /api/analysis/member version: ${MEMBER_ANALYSIS_VERSION}`);
    const data: MemberAnalysisRequest = await request.json();

    if (!data.penName) {
      return NextResponse.json(
        { error: "Missing required field: penName" },
        { status: 400 }
      );
    }

    let posts = data.posts;

    // 自動取得モード
    if (data.autoFetch && data.email) {
      console.log(`📚 Fetching posts for ${data.penName} (${data.email})`);

      try {
        const db = getD1Client();
        posts = await getMemberPosts(db, data.email, data.limit || 10);

        if (!posts || posts.length === 0) {
          const nowSec = Math.floor(Date.now() / 1000);
          const saveResult = await db.execute({
            sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, createdAt, updatedAt)
                  VALUES (?, ?, NULL, '', ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
                  ON CONFLICT(email) DO UPDATE SET
                    penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                    aiSummary = excluded.aiSummary,
                    aiTagsJson = excluded.aiTagsJson,
                    aiUpdatedAt = excluded.aiUpdatedAt,
                    updatedAt = strftime('%s', 'now')`,
            params: [
              data.email,
              data.penName || "部員",
              EMPTY_POSTS_ANALYSIS,
              JSON.stringify(["#投稿準備中", "#文芸部", "#部員紹介"]),
              nowSec,
            ],
          });

          if (!saveResult.success) {
            console.error("Failed to save empty-post analysis:", saveResult.error);
          }

          return NextResponse.json({
            penName: data.penName,
            email: data.email,
            analysis: EMPTY_POSTS_ANALYSIS,
            fromCache: false,
            postsAnalyzed: 0,
            generatedAt: new Date().toISOString(),
          });
        }

        console.log(`✅ Fetched ${posts.length} posts for analysis`);
      } catch (error) {
        console.error("Failed to fetch posts from DB:", error);
        return NextResponse.json(
          { error: "Failed to fetch member posts from database" },
          { status: 500 }
        );
      }
    }

    // 投稿データの検証
    if (!posts || posts.length === 0) {
      return NextResponse.json({
        penName: data.penName,
        email: data.email || null,
        analysis: EMPTY_POSTS_ANALYSIS,
        fromCache: false,
        postsAnalyzed: 0,
        generatedAt: new Date().toISOString(),
      });
    }

    // 本文のサイズチェック
    const processedPosts = posts.map((post) => ({
      title: post.title,
      body: post.body.length > 1000 ? post.body.substring(0, 1000) + "..." : post.body,
      tag: post.tag || "一般",
    }));

    console.log(
      `🔍 Analyzing ${data.penName} with ${processedPosts.length} posts`
    );

    const memberKey = data.email || `pen:${data.penName}`;
    const db = getD1Client();
    const result = await generateMemberAnalysisWithCache(db, {
      memberKey,
      penName: data.penName,
      posts: processedPosts,
      forceRefresh: Boolean(data.forceRefresh),
    });

    const tagsResult = await generateMemberTagsWithCache(db, {
      memberKey,
      penName: data.penName,
      posts: processedPosts,
      forceRefresh: Boolean(data.forceRefresh),
    });

    const finalTags = tagsResult.tags;
    const tagsJson = JSON.stringify(finalTags);

    if (data.email && result.text && result.text.trim().length > 0) {
      const summary = String(result.text).replace(/\s+/g, " ").trim().slice(0, MEMBER_SUMMARY_MAX_LENGTH);
      console.log(`💾 Saving analysis for ${data.email}: ${summary.slice(0, 30)}...`);
      console.log(`📌 Saving tags: ${tagsJson}`);
      const nowSec = Math.floor(Date.now() / 1000);
      
      try {
        const updateRes = await db.execute({
          sql: `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, aiSummary, aiTagsJson, aiUpdatedAt, createdAt, updatedAt)
                VALUES (?, ?, NULL, '', ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
                ON CONFLICT(email) DO UPDATE SET
                  penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
                  aiSummary = excluded.aiSummary,
                  aiTagsJson = excluded.aiTagsJson,
                  aiUpdatedAt = excluded.aiUpdatedAt,
                  updatedAt = strftime('%s', 'now')`,
          params: [data.email, data.penName || "部員", summary, tagsJson, nowSec],
        });
        console.log(`✅ DB update result:`, updateRes);
      } catch (e) {
        console.error(`❌ DB update failed for ${data.email}:`, e);
      }
    } else {
      console.warn(`⚠️ Empty analysis for ${data.penName}, skipping DB save`);
    }

    console.log(`✅ Member analysis generated for ${data.penName}`);

    return NextResponse.json({
      penName: data.penName,
      email: data.email || null,
      analysis: result.text,
      fromCache: result.fromCache,
      aiTags: finalTags,
      tagsFromCache: tagsResult.fromCache,
      postsAnalyzed: processedPosts.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Member analysis generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate member analysis",
      },
      { status: 500 }
    );
  }
}
