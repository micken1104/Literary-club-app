/**
 * POST /api/analysis/post
 * 個別作品への AI 講評を生成
 * 
 * リクエスト:
 * {
 *   "postId": "uuid",
 *   "title": "作品タイトル",
 *   "body": "作品本文",
 *   "tag": "テーマ"
 * }
 */

import { NextResponse, NextRequest } from "next/server";
import { getD1Client } from "@/app/lib/db";
import { generatePostReviewWithCache } from "@/app/lib/aiReviewService";

interface PostReviewRequest {
  postId: string;
  title: string;
  body?: string;
  r2Key?: string;
  tag?: string;
  forceRefresh?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const data: PostReviewRequest = await request.json();

    // 入力検証
    if (!data.postId || !data.title || (!data.body && !data.r2Key)) {
      return NextResponse.json(
        { error: "Missing required fields: postId, title, and body or r2Key" },
        { status: 400 }
      );
    }

    console.log(`📝 Generating review for post: ${data.postId}`);

    const db = getD1Client();
    const result = await generatePostReviewWithCache(db, {
      postId: data.postId,
      title: data.title,
      body: data.body,
      r2Key: data.r2Key,
      tag: data.tag || "創作",
      forceRefresh: Boolean(data.forceRefresh),
    });

    console.log(`✅ Review generated for ${data.postId}`);

    return NextResponse.json({
      postId: data.postId,
      review: result.text,
      fromCache: result.fromCache,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Post review generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate review",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analysis/post?postId=...
 * 既存の講評キャッシュを取得（オプション）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Missing required parameter: postId" },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching review cache for post: ${postId}`);

    const db = getD1Client();
    const nowMs = Date.now();
    const cacheResult = await db.execute<{ resultText: string }>({
      sql: `SELECT resultText
            FROM aiAnalysisCache
            WHERE cacheType = ?
              AND targetId = ?
              AND expiresAt > ?
            ORDER BY updatedAt DESC
            LIMIT 1`,
      params: ["post_review", postId, nowMs],
    });

    if (!cacheResult.success) {
      return NextResponse.json(
        { error: cacheResult.error || "Failed to fetch review cache" },
        { status: 500 }
      );
    }

    const review = String(cacheResult.results?.[0]?.resultText || "").trim();

    if (!review) {
      return NextResponse.json(
        { postId, review: null, cached: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      postId,
      review,
      cached: true,
    });
  } catch (error) {
    console.error("❌ Failed to fetch review cache:", error);
    return NextResponse.json(
      { error: "Failed to fetch review cache" },
      { status: 500 }
    );
  }
}
