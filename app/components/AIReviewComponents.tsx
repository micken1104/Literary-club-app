/**
 * AI 講評機能の使用例コンポーネント
 * フロントエンドでの実装参考
 */

"use client";

import { useState } from "react";
import { usePostReview, useWeeklySummary, useMemberAnalysis } from "@/app/hooks/useAIAnalysis";
import { Button, Spinner } from "@/app/components/ui";
import { Sparkles, Loader } from "lucide-react";
import type { Post, MemberProfile } from "@/app/types/post";

/**
 * 個別投稿にAI講評を追加するコンポーネント
 */
export function PostReviewSection({ post }: { post: Post }) {
  const { generateReview, isGenerating, review, error } = usePostReview();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerateReview = () => {
    generateReview(post.id, post.title, post.body, post.tag);
    setIsExpanded(true);
  };

  return (
    <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
      <button
        onClick={handleGenerateReview}
        disabled={isGenerating}
        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
      >
        <Sparkles size={16} />
        {isGenerating ? "講評生成中..." : "AI講評をもらう"}
      </button>

      {isExpanded && (
        <div className="mt-3">
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-gray-500">AI が講評を生成しています...</span>
            </div>
          )}

          {review && !isGenerating && (
            <div className="p-3 bg-white rounded border-l-4 border-blue-400">
              <p className="text-sm text-gray-700 leading-relaxed">{review}</p>
              <p className="text-xs text-gray-400 mt-2">
                ✨ Cloudflare AI による講評
              </p>
            </div>
          )}

          {error && !isGenerating && (
            <div className="p-3 bg-red-50 rounded text-sm text-red-600">
              エラー: {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 週末の全体講評を表示するコンポーネント
 */
export function WeeklySummarySection() {
  const { generateSummary, isGenerating, summary, aggregatedData, error } =
    useWeeklySummary();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerateSummary = () => {
    // 実際の実装では、ここで DB から投稿データを集計します
    generateSummary({
      totalPosts: 12,
      themes: ["恋愛", "冒険", "日常"],
      commonKeywords: ["風", "心", "夜", "光", "思い出"],
      topPostMentions: ["春の想い", "心を開く", "未来への一歩"],
    });
    setIsExpanded(true);
  };

  return (
    <div className="my-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-amber-900">📚 今週の総括</h3>
        <Button
          onClick={handleGenerateSummary}
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          <Sparkles size={16} />
          {isGenerating ? "生成中..." : "総括を生成"}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-4">
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-sm text-gray-600">
                AI が今週の総括を作成しています...
              </span>
            </div>
          )}

          {summary && !isGenerating && (
            <div className="space-y-3">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <p className="text-base text-gray-800 leading-relaxed font-medium">
                  {summary}
                </p>
              </div>

              {aggregatedData && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2 bg-white rounded text-sm">
                    <p className="text-gray-500">投稿数</p>
                    <p className="text-xl font-bold text-amber-600">
                      {aggregatedData.totalPosts}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded text-sm">
                    <p className="text-gray-500">テーマ</p>
                    <p className="text-sm font-medium text-amber-600">
                      {aggregatedData.themes.join("、")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && !isGenerating && (
            <div className="p-3 bg-red-50 rounded text-sm text-red-600">
              エラー: {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 部員プロフィール分析コンポーネント
 */
export function MemberAnalysisCard({ member }: { member: MemberProfile }) {
  const { analyze, isAnalyzing, analysis, postsAnalyzed, error } =
    useMemberAnalysis();
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyze = () => {
    // DB から自動取得
    analyze({
      email: member.email,
      penName: member.penName,
      autoFetch: true,
      limit: 10,
    });
    setShowAnalysis(true);
  };

  return (
    <div className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-bold text-lg">{member.penName}</h4>
          <p className="text-xs text-gray-500">{member.email}</p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          size="sm"
          variant="ghost"
        >
          <Sparkles size={14} />
          {isAnalyzing ? "分析中..." : "分析"}
        </Button>
      </div>

      {showAnalysis && (
        <div className="mt-3 pt-3 border-t">
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-gray-500">
                このメンバーのスタイルを分析しています...
              </span>
            </div>
          )}

          {analysis && !isAnalyzing && (
            <div className="space-y-2">
              <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                <p className="text-sm text-gray-700">{analysis}</p>
              </div>
              <p className="text-xs text-gray-500">
                分析対象: {postsAnalyzed} 件の投稿
              </p>
            </div>
          )}

          {error && !isAnalyzing && (
            <div className="p-2 text-xs text-red-600 bg-red-50 rounded">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * バッチ処理の例：複数投稿への一括講評
 */
export function PostReviewBatchSection({
  posts,
  onReviewsGenerated,
}: {
  posts: Post[];
  onReviewsGenerated?: (reviews: any[]) => void;
}) {
  const { generateReviewsBatch, isGenerating, reviews, error } =
    usePostReviewBatch();

  const handleGenerateAllReviews = async () => {
    const postsData = posts.map((p) => ({
      postId: p.id,
      title: p.title,
      body: p.body,
      tag: p.tag,
    }));

    const result = await generateReviewsBatch(postsData);
    onReviewsGenerated?.(result);
  };

  return (
    <div className="my-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">🎯 今月の全投稿に講評を付ける</h4>
        <Button
          onClick={handleGenerateAllReviews}
          disabled={isGenerating}
          size="sm"
        >
          {isGenerating ? (
            <>
              <Spinner size="sm" className="mr-1" />
              生成中...
            </>
          ) : (
            "一括生成"
          )}
        </Button>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        対象： {posts.length} 件
      </p>

      {isGenerating && (
        <div className="text-center py-4">
          <Spinner size="md" className="mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            {reviews?.length || 0} / {posts.length} の講評が完成しました...
          </p>
        </div>
      )}

      {reviews && reviews.length > 0 && !isGenerating && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {reviews.map((item, idx) => (
            <div key={idx} className="p-3 bg-white rounded border-l-2 border-green-400">
              <p className="text-xs font-medium text-gray-600 mb-1">
                {posts[idx]?.title || `投稿 ${idx + 1}`}
              </p>
              <p className="text-sm text-gray-700">{item.review}</p>
            </div>
          ))}
        </div>
      )}

      {error && !isGenerating && (
        <div className="p-3 bg-red-50 rounded text-sm text-red-600">
          エラー: {error}
        </div>
      )}
    </div>
  );
}

// 未使用のインポート修正
import { usePostReviewBatch } from "@/app/hooks/useAIAnalysis";
