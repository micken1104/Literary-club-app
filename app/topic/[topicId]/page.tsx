"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import useSWRMutation from "swr/mutation";
import { useAppTheme } from "@/app/hooks/useAppTheme";
import { useTopicDetail } from "@/app/hooks/useTopicDetail";
import { useTopicAnalysis } from "@/app/hooks/useTopicAnalysis";
import { usePostMutations } from "@/app/hooks/usePostMutations";
import { useUserProfile } from "@/app/hooks/useUserProfile";
import { parseFile } from "@/app/lib/fileParser";
import type { Post } from "@/app/types/post";
import {
  ArrowLeft,
} from "lucide-react";

import { tv } from "tailwind-variants";
import {
  ParticipantAvatars,
  AIAnalysisSection,
  PostFormSection,
  PostCard,
} from "./components";

const topicScene = tv({
  base: "topic-detail-scene min-h-screen p-4 md:p-6 relative z-10",
  variants: {
    theme: {
      street: "",
      chrome: "chrome-theme-detail",
      library: "",
    },
  },
});

const topicHeader = tv({
  base: "flex items-center mb-8 p-4",
  variants: {
    theme: {
      street: "bg-white/20 backdrop-blur-md shadow-street-hard rounded-2xl",
      chrome: "bg-black border-b border-white/30",
      library: "bg-library-bg rounded-2xl shadow-library-neu-lg",
    },
  },
});

const topicHeaderTitle = tv({
  base: "text-center flex-1 tracking-wide",
  variants: {
    theme: {
      street: "text-3xl font-black uppercase",
      chrome: "text-xl font-black text-white",
      library: "text-2xl font-serif font-bold text-[#3F3427]",
    },
  },
});

const parentTopicBox = tv({
  base: "p-4 mb-6",
  variants: {
    theme: {
      street: "bg-blue-50 border-l-4 border-blue-500 rounded-xl",
      chrome: "border-l-2 font-black border-white/40",
      library: "bg-library-surface border-l-4 border-[#A38D73] rounded-xl shadow-library-neu-lg",
    },
  },
});

const aiSection = tv({
  base: "p-6 mb-8",
  variants: {
    theme: {
      street: "jsr-card bg-linear-to-br from-purple-300 to-pink-300 rounded-2xl",
      chrome: "bg-transparent border-0 border-b border-white/25 rounded-none",
      library: "jsr-card bg-library-surface rounded-2xl shadow-library-neu",
    },
  },
});

const repliesHeader = tv({
  base: "flex items-center justify-between mb-4 p-4",
  variants: {
    theme: {
      street: "bg-white/20 backdrop-blur-md shadow-street-hard rounded-2xl",
      chrome: "border-b border-white/30",
      library: "bg-library-cream rounded-2xl shadow-library-neu",
    },
  },
});

export default function TopicPage() {
  const aiReadingSettingKey = "lit-club-ai-reading-enabled";
  const { data: session } = useSession();
  const { appTheme } = useAppTheme();
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId as string;

  // --- SWR フックでデータ取得 ---
  const {
    topic,
    parentTopic,
    replies,
    postsLoading,
    getDisplayName,
    getDisplayIcon,
    replyParticipants,
    mutatePosts,
    mutateComments,
    mutateLikes,
  } = useTopicDetail(topicId);

  const {
    analysisLoading,
    analysisError,
    analysisResult,
    generateAnalysis,
  } = useTopicAnalysis(topicId);

  const { penName } = useUserProfile(session);

  // --- Mutation フック ---
  const {
    saveReply: triggerSaveReply,
    saveEditedPost: triggerSaveEditedPost,
    toggleTopicDeadline,
    deletePost,
  } = usePostMutations({
    session,
    penName,
    mutatePosts,
  });

  // --- ローカル UI state ---
  const [newPost, setNewPost] = useState<Partial<Post>>({ title: "", body: "", tag: "創作" });
  const [aiReadingEnabled, setAiReadingEnabled] = useState(true);
  const [iconCacheBust] = useState<number>(Date.now());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(aiReadingSettingKey);
      setAiReadingEnabled(saved !== "0");
    } catch {
      setAiReadingEnabled(true);
    }
  }, []);

  const isDeadlineExpired = (deadline: number | null | undefined) => {
    if (!deadline) return false;
    return Date.now() > deadline;
  };

  // --- 初期ロード時に deadline expired なら分析を自動生成 ---
  useEffect(() => {
    if (
      topic &&
      topic.isTopicPost === 1 &&
      isDeadlineExpired(topic.deadline) &&
      !analysisResult &&
      !analysisLoading
    ) {
      // キャッシュから取得するか、存在しなければ生成
      void generateAnalysis(false);
    }
  }, [topic?.id, analysisResult, analysisLoading, generateAnalysis]);

  const handleToggleTopicDeadline = () => {
    if (!topic || topic.isTopicPost !== 1) {
      return;
    }

    const expired = isDeadlineExpired(topic.deadline);
    const nextDeadline = expired ? null : Date.now();

    toggleTopicDeadline(topic.id, nextDeadline, () => {
      if (!expired) {
        void generateAnalysis(true);
      }
    });
  };

  const { trigger: triggerParseFile, isMutating: isParsing } = useSWRMutation(
    "parseFile",
    (_key: string, { arg }: { arg: File }) => parseFile(arg),
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    triggerParseFile(file, {
      throwOnError: false,
      onSuccess: (result) => {
        setNewPost((prev) => ({ ...prev, title: result.title, body: result.body }));
      },
      onError: (error) => {
        console.error("ファイル解析エラー:", error);
        alert("ファイルの解析に失敗しました");
      },
    });
  };

  const saveReply = () => {
    if (topic && isDeadlineExpired(topic.deadline)) {
      alert("このお題の締め切りが過ぎているため、投稿できません");
      return;
    }
    triggerSaveReply(topicId, newPost, () => {
      setNewPost({ title: "", body: "", tag: "創作" });
    });
  };

  if (postsLoading) {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  if (!topic) {
    return (
      <div className="text-center py-10">
        <p>投稿が見つかりませんでした</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-sm"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className={topicScene({ theme: appTheme })}>
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className={topicHeader({ theme: appTheme })}>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-cyan-400 text-black border-3 border-black rounded-full font-black uppercase shake-hover flex items-center gap-2 hover:translate-y-[-2px] transition-all"
          >
            <ArrowLeft size={18} strokeWidth={3} />
            戻る
          </button>
          <h1 className={topicHeaderTitle({ theme: appTheme })}>投稿詳細</h1>
        </div>

        {/* 親のお題（お題への返信の場合） */}
        {parentTopic && (
          <div className={parentTopicBox({ theme: appTheme })}>
            <p className="text-sm font-bold text-blue-600 chrome:text-blue-400 mb-2">このお題への返信です</p>
            <h3 className="text-lg font-black text-black chrome:text-blue-200 mb-2 uppercase">{parentTopic.title}</h3>
            <p className="text-sm text-gray-700 chrome:text-gray-300 line-clamp-2">{parentTopic.body}</p>
          </div>
        )}

        {/* トピック表示 */}
        <PostCard
          post={topic}
          variant="topic"
          appTheme={appTheme}
          session={session}
          penName={penName}
          onEditSave={(postId, title, body) => triggerSaveEditedPost(postId, title, body)}
          iconCacheBust={iconCacheBust}
          getDisplayIcon={getDisplayIcon}
          getDisplayName={getDisplayName}
          onDelete={() => deletePost(topic.id, () => setTimeout(() => router.push("/"), 300))}
          deleteDisabled={replies.length > 0}
          deleteDisabledReason={replies.length > 0 ? "この投稿に返信があるため削除できません" : undefined}
          mutateComments={mutateComments}
          mutateLikes={mutateLikes}
        />

        {/* AI分析 - お題の場合のみ表示 */}
        {topic.isTopicPost === 1 && (
        <div className={aiSection({ theme: appTheme })}>
          <AIAnalysisSection
            repliesCount={replies.length}
            aiReadingEnabled={aiReadingEnabled}
            analysisLoading={analysisLoading}
            analysisError={analysisError}
            analysisResult={analysisResult}
            isDeadlineExpired={isDeadlineExpired(topic.deadline)}
            onToggleDeadline={handleToggleTopicDeadline}
          />
        </div>
        )}

        {/* 投稿フォーム（ファイルインポート専用） - お題の場合のみ表示 */}
        {session && topic.isTopicPost === 1 && (
          <PostFormSection
            theme={appTheme}
            isDeadlineExpired={isDeadlineExpired(topic.deadline)}
            newPost={newPost}
            isParsing={isParsing}
            onFileChange={handleFileChange}
            onTagChange={(tag) => setNewPost({ ...newPost, tag })}
            onSubmit={saveReply}
          />
        )}

        {/* 投稿一覧 - お題の場合のみ表示 */}
        {topic.isTopicPost === 1 && (
        <div>
          <div className={repliesHeader({ theme: appTheme })}>
            <h3 className="text-xl font-black uppercase tracking-wide">このお題への投稿 ({replies.length})</h3>
            {replyParticipants.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase">参加者</span>
                <ParticipantAvatars
                  participants={replyParticipants}
                  maxDisplay={8}
                  size="md"
                />
              </div>
            )}
          </div>
          {replies.length === 0 ? (
            <p className="text-center py-8 font-black uppercase text-xl">まだ投稿がありません</p>
          ) : (
            replies.map((reply) => (
              <PostCard
                key={reply.id}
                post={reply}
                variant="reply"
                appTheme={appTheme}
                session={session}
                penName={penName}
                onEditSave={(postId, title, body) => triggerSaveEditedPost(postId, title, body)}
                iconCacheBust={iconCacheBust}
                getDisplayIcon={getDisplayIcon}
                getDisplayName={getDisplayName}
                onDelete={() => deletePost(reply.id, () => alert("削除しました！"))}
                mutateComments={mutateComments}
                mutateLikes={mutateLikes}
              />
            ))
          )}
        </div>
        )}
      </div>
    </div>
  );
}
