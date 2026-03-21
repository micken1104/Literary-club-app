/**
 * POST /api/analysis/weekly
 * 週末の全体講評を生成
 * 
 * リクエスト:
 * {
 *   "startDate": 1711000000000,  // タイムスタンプ（ミリ秒）
 *   "endDate": 1711500000000
 * }
 * または、手動で集計データを渡す：
 * {
 *   "totalPosts": 15,
 *   "themes": ["恋愛", "冒険"],
 *   "commonKeywords": ["風", "夜"],
 *   "topPostMentions": ["心を開く", "未来への一歩"]
 * }
 */

import { NextResponse, NextRequest } from "next/server";
import { getD1Client } from "@/app/lib/db";
import { getPostsByDateRange } from "@/app/lib/r2Utils";
import {
  buildWeeklyAggregate,
  generateWeeklySummaryWithCache,
} from "@/app/lib/aiReviewService";

interface WeeklySummaryRequest {
  startDate?: number;
  endDate?: number;
  totalPosts?: number;
  themes?: string[];
  commonKeywords?: string[];
  topPostMentions?: string[];
  forceRefresh?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const data: WeeklySummaryRequest = await request.json();
    const db = getD1Client();

    let aggregatedData;
    let cacheKey = "weekly:manual";

    // 1. 手動で集計データが渡された場合
    if (data.totalPosts && data.themes && data.commonKeywords) {
      aggregatedData = {
        totalPosts: data.totalPosts,
        themes: data.themes,
        commonKeywords: data.commonKeywords,
        topPostMentions: data.topPostMentions || [],
      };
      cacheKey = `manual:${data.totalPosts}:${data.themes.join("|")}`;
    }
    // 2. 日付範囲が渡された場合、DB から取得して集計
    else if (data.startDate && data.endDate) {
      console.log(
        `📊 Fetching posts from ${new Date(data.startDate).toISOString()} to ${new Date(data.endDate).toISOString()}`
      );
      const posts = await getPostsByDateRange(db, data.startDate, data.endDate);
      if (posts.length === 0) {
        return NextResponse.json(
          { error: "指定期間に分析対象の投稿がありません" },
          { status: 404 }
        );
      }

      aggregatedData = buildWeeklyAggregate(posts);
      cacheKey = `range:${data.startDate}:${data.endDate}`;

      console.log(`📈 Aggregated data:`, aggregatedData);
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either (startDate, endDate) or (totalPosts, themes, commonKeywords)",
        },
        { status: 400 }
      );
    }

    console.log("🎯 Generating weekly summary...");

    const result = await generateWeeklySummaryWithCache(db, {
      cacheKey,
      aggregate: aggregatedData,
      forceRefresh: Boolean(data.forceRefresh),
    });

    console.log("✅ Weekly summary generated");

    return NextResponse.json({
      summary: result.text,
      fromCache: result.fromCache,
      aggregatedData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Weekly summary generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate weekly summary",
      },
      { status: 500 }
    );
  }
}
