import { useState, useCallback, useEffect } from "react";

type TopicAnalysis = {
  overview: string;
  strengths: string[];
  suggestions: string[];
  postFeedback: Array<{
    postId: string;
    title: string;
    praise: string;
  }>;
};

export function useTopicAnalysis(topicId: string) {
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<TopicAnalysis | null>(null);

  const generateAnalysis = useCallback(async (forceRefresh = false) => {
    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const res = await fetch("/api/analysis/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, forceRefresh }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data?.error || "分析の生成に失敗しました");
        return;
      }
      setAnalysisResult(data as TopicAnalysis);
    } catch {
      setAnalysisError("分析の生成に失敗しました");
    } finally {
      setAnalysisLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    let active = true;

    const loadCachedAnalysis = async () => {
      try {
        const res = await fetch(`/api/analysis/topic?topicId=${encodeURIComponent(topicId)}`);
        const data = (await res.json()) as {
          analysis?: TopicAnalysis | null;
          error?: string;
        };

        if (!active || !res.ok) {
          return;
        }

        if (data.analysis) {
          setAnalysisResult(data.analysis);
        }
      } catch {
        // キャッシュ読込失敗時は無視して手動生成にフォールバック
      }
    };

    if (topicId) {
      void loadCachedAnalysis();
    }

    return () => {
      active = false;
    };
  }, [topicId]);

  return {
    analysisLoading,
    analysisError,
    analysisResult,
    generateAnalysis,
  };
}
