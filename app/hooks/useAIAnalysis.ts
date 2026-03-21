/**
 * useAIAnalysis フック
 * Cloudflare Workers AI を使った分析機能を React コンポーネントで使用
 */

import useSWRMutation from "swr/mutation";

/**
 * 個別作品への講評を取得
 */
export function usePostReview() {
  const { trigger, isMutating, error, data } = useSWRMutation(
    "/api/analysis/post",
    async (
      _url: string,
      {
        arg,
      }: {
        arg: {
          postId: string;
          title: string;
          body?: string;
          r2Key?: string;
          tag?: string;
          forceRefresh?: boolean;
        };
      }
    ) => {
      const res = await fetch("/api/analysis/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate review");
      }

      return res.json();
    },
    { throwOnError: false }
  );

  return {
    generateReview: (
      postId: string,
      title: string,
      body?: string,
      tag?: string,
      r2Key?: string,
      forceRefresh?: boolean
    ) => trigger({ postId, title, body, tag, r2Key, forceRefresh }),
    isGenerating: isMutating,
    error: error?.message,
    review: data?.review,
  };
}

/**
 * 週末の全体講評を取得
 */
export function useWeeklySummary() {
  const { trigger, isMutating, error, data } = useSWRMutation(
    "/api/analysis/weekly",
    async (
      _url: string,
      {
        arg,
      }: {
        arg:
          | {
              startDate: number;
              endDate: number;
            }
          | {
              totalPosts: number;
              themes: string[];
              commonKeywords: string[];
              topPostMentions: string[];
            };
      }
    ) => {
      const res = await fetch("/api/analysis/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || "Failed to generate weekly summary"
        );
      }

      return res.json();
    },
    { throwOnError: false }
  );

  return {
    generateSummary: (
      params:
        | {
            startDate: number;
            endDate: number;
          }
        | {
            totalPosts: number;
            themes: string[];
            commonKeywords: string[];
            topPostMentions: string[];
          }
    ) => trigger(params),
    isGenerating: isMutating,
    error: error?.message,
    summary: data?.summary,
    aggregatedData: data?.aggregatedData,
  };
}

/**
 * 部員の文体・テーマ分析を取得
 */
export function useMemberAnalysis() {
  const { trigger, isMutating, error, data } = useSWRMutation(
    "/api/analysis/member",
    async (
      _url: string,
      {
        arg,
      }: {
        arg:
          | {
              penName: string;
              email: string;
              autoFetch: true;
              limit?: number;
              forceRefresh?: boolean;
            }
          | {
              penName: string;
              posts: Array<{
                title: string;
                body: string;
                tag: string;
              }>;
            };
      }
    ) => {
      const res = await fetch("/api/analysis/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || errorData.warning || "Failed to analyze member"
        );
      }

      return res.json();
    },
    { throwOnError: false }
  );

  return {
    analyze: (
      params:
        | {
            penName: string;
            email: string;
            autoFetch: true;
            limit?: number;
            forceRefresh?: boolean;
          }
        | {
            penName: string;
            posts: Array<{
              title: string;
              body: string;
              tag: string;
            }>;
          }
    ) => trigger(params),
    isAnalyzing: isMutating,
    error: error?.message,
    analysis: data?.analysis,
    postsAnalyzed: data?.postsAnalyzed,
  };
}

/**
 * バッチ処理用：複数の作品に対して講評を生成
 */
export function usePostReviewBatch() {
  const { trigger, isMutating, error, data } = useSWRMutation(
    "/api/analysis/post",
    async (
      _url: string,
      {
        arg,
      }: {
        arg: Array<{
          postId: string;
          title: string;
          body: string;
          tag?: string;
        }>;
      }
    ) => {
      // 複数投稿に対して並列で講評を生成
      const reviews = await Promise.all(
        arg.map(async (post) => {
          const res = await fetch("/api/analysis/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(post),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to generate review");
          }

          return res.json();
        })
      );

      return reviews;
    },
    { throwOnError: false }
  );

  return {
    generateReviewsBatch: (
      posts: Array<{
        postId: string;
        title: string;
        body: string;
        tag?: string;
      }>
    ) => trigger(posts),
    isGenerating: isMutating,
    error: error?.message,
    reviews: data,
  };
}
