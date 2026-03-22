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

        if (!active) {
          return;
        }

        if (!res.ok) {
          setAnalysisError(data?.error || "分析の読込に失敗しました");
          return;
        }

        if (data.analysis) {
          setAnalysisResult(data.analysis);
        } else {
          // キャッシュが存在しない場合は明示的に null をセット
          // （フロントエンドが「結果なし」を認識できるようにする）
          setAnalysisResult(null);
        }
      } catch (err) {
        if (!active) return;
        // キャッシュ読込失敗時は無視
        console.error("キャッシュ読込エラー:", err);
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
