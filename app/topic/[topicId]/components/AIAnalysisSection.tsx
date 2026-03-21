"use client";

interface TopicAnalysis {
  overview: string;
  strengths: string[];
  suggestions: string[];
  postFeedback: Array<{
    postId: string;
    title: string;
    praise: string;
  }>;
}

interface AIAnalysisSectionProps {
  repliesCount: number;
  aiReadingEnabled: boolean;
  analysisLoading: boolean;
  analysisError: string | null;
  analysisResult: TopicAnalysis | null;
  isDeadlineExpired: boolean;
  onToggleDeadline: () => void;
}

export function AIAnalysisSection({
  repliesCount,
  aiReadingEnabled,
  analysisLoading,
  analysisError,
  analysisResult,
  isDeadlineExpired,
  onToggleDeadline,
}: AIAnalysisSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-2xl font-black uppercase tracking-wide text-black chrome:text-purple-300">
          AI講評
        </h3>
        <button
          onClick={onToggleDeadline}
          disabled={analysisLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analysisLoading
            ? "処理中..."
            : isDeadlineExpired
              ? "締め切り解除"
              : "お題を締め切る"}
        </button>
      </div>

      <p className="text-xs text-slate-500 chrome:text-slate-300">
        AI講評は締め切り後に生成されます。締め切り解除後に再度締め切ると再生成できます。
      </p>

      {!aiReadingEnabled && (
        <p className="text-sm text-slate-500 chrome:text-slate-200">
          あなたの設定はOFFのため、あなたの投稿は講評対象から除外されます。
        </p>
      )}

      {repliesCount === 0 && (
        <p className="text-sm text-slate-500 chrome:text-slate-200">
          投稿が集まると分析できます。
        </p>
      )}

      {analysisError && (
        <p className="text-sm text-red-600 chrome:text-red-400">
          {analysisError}
        </p>
      )}

      {analysisResult && isDeadlineExpired && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 chrome:text-slate-100 mb-1">
              総評
            </p>
            <p className="text-sm text-slate-600 chrome:text-slate-100 whitespace-pre-wrap">
              {analysisResult.overview}
            </p>
          </div>
          
          <div>
            <p className="text-sm font-semibold text-slate-700 chrome:text-slate-100 mb-2">
              各作品の分析
            </p>
            <div className="space-y-2">
              {analysisResult.postFeedback?.map((item, idx) => (
                <div
                  key={`post-${item.postId || idx}`}
                  className="rounded-lg border border-slate-200 chrome:border-slate-700 p-3"
                >
                  <p className="text-sm font-bold text-slate-800 chrome:text-slate-100">
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-600 chrome:text-slate-100 mt-1">
                    講評: {item.praise}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
