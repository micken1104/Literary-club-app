"use client";

import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAppTheme } from "@/app/hooks/useAppTheme";
import { Card, CardBody, Chip } from "@/app/components/ui";
import { Save } from "lucide-react";
import {
  HandDrawnPlusIcon,
  HandDrawnHeartIcon,
  HandDrawnCommentIcon,
  ChromeMessageIcon,
} from "@/app/components/HandDrawnIcons";
import { usePosts } from "@/app/hooks/usePosts";
import { tv } from "tailwind-variants";

const fab = tv({
  base: "fixed right-6 bottom-24 z-40 h-14 rounded-full text-base font-black px-6 transition-all flex items-center gap-2 uppercase",
  variants: {
    theme: {
      street: "bg-yellow-400 text-black border-4 border-white shadow-[0_8px_0_rgba(0,0,0,0.9)] hover:shadow-[0_10px_0_rgba(0,0,0,0.9)] hover:translate-y-[-2px] active:translate-y-[2px] active:shadow-[0_6px_0_rgba(0,0,0,0.9)] shake-hover",
      chrome: "bg-[#143021] text-[#e6ffef] border border-[#3a7b56] shadow-[0_8px_0_rgba(8,14,10,0.9)] hover:shadow-[0_10px_0_rgba(8,14,10,0.9)] hover:bg-[#1a3f2b] hover:translate-y-[-2px] active:translate-y-[2px] active:shadow-[0_6px_0_rgba(8,14,10,0.9)]",
      library: "bg-library-surface text-[#3F3427] border-0 shadow-library-neu-sm hover:shadow-library-neu-hover",
    },
  },
});

type PostsTabContentProps = {
  onCreatePost: () => void;
};

export function PostsTabContent({
  onCreatePost,
}: PostsTabContentProps) {
  const { data: session } = useSession();
  const { appTheme } = useAppTheme();
  const {
    freePosts,
    topicReplies,
    getDisplayIcon,
    getDisplayName,
  } = usePosts();

  const [reviewByPostId, setReviewByPostId] = useState<Record<string, string>>({});
  const [reviewErrorByPostId, setReviewErrorByPostId] = useState<Record<string, string>>({});

  const visiblePosts = [...topicReplies, ...freePosts].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  useEffect(() => {
    if (visiblePosts.length === 0) {
      return;
    }

    void Promise.all(
      visiblePosts.map(async (post) => {
        try {
          const response = await fetch(`/api/analysis/post?postId=${post.id}`);
          const data = (await response.json()) as { review?: string | null; error?: string };

          if (!response.ok) {
            throw new Error(data.error || "講評の取得に失敗しました");
          }

          return {
            postId: post.id,
            review: data.review || "",
            error: "",
          };
        } catch (error) {
          return {
            postId: post.id,
            review: "",
            error: error instanceof Error ? error.message : "講評の取得に失敗しました",
          };
        }
      })
    ).then((results) => {
      const nextReviewMap: Record<string, string> = {};
      const nextErrorMap: Record<string, string> = {};

      results.forEach((item) => {
        nextReviewMap[item.postId] = item.review;
        nextErrorMap[item.postId] = item.error;
      });

      setReviewByPostId(nextReviewMap);
      setReviewErrorByPostId(nextErrorMap);
    });
  }, [topicReplies, freePosts]);

  return (
    <>
      <div className="p-3 space-y-3 chrome:bg-[#0f1411] rounded-md">
        {(freePosts.length === 0 && topicReplies.length === 0) ? (
          <div className="p-10 text-center">
            <Save size={34} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 chrome:text-[#b8ffd1] text-sm font-medium">まだ投稿がありません</p>
            <p className="text-gray-400 chrome:text-[#9fc6ad] text-xs mt-2">右下のボタンから投稿を作成できます。</p>
          </div>
        ) : (
          <>
            {visiblePosts.map((post) => {
              const isTopicReply = !!post.parentPostId;
              return (
                <Card 
                  key={post.id}
                  shadow="none"
                  theme={appTheme}
                  className={appTheme !== "chrome" ? "bg-white" : "chrome:bg-[#111915] chrome:border chrome:border-[#305f45]"}
                >
                  <CardBody className="p-4 gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getDisplayIcon(post.authorEmail) ? (
                          <img
                            src={getDisplayIcon(post.authorEmail) || ""}
                            alt="投稿者アイコン"
                            className="w-8 h-8 min-w-8 min-h-8 shrink-0 rounded-full object-cover border-2 border-black chrome:border-white"
                          />
                        ) : (
                          <div className="w-8 h-8 min-w-8 min-h-8 shrink-0 rounded-full bg-yellow-300 border-2 border-black chrome:border-white" />
                        )}
                        <span className="font-black text-base uppercase text-black chrome:text-[#e2ffec]">{getDisplayName(post.authorEmail, post.author)}</span>
                        {isTopicReply ? (
                          <Chip
                            size="md"
                            theme={appTheme}
                            className={appTheme !== "library" ? "bg-purple-400 text-white font-bold border-2 border-black" : ""}
                          >
                            お題
                          </Chip>
                        ) : (
                          <Chip
                            size="md"
                            theme={appTheme}
                            className={appTheme !== "library" ? "bg-cyan-400 text-black font-bold border-2 border-black" : ""}
                          >
                            自由投稿
                          </Chip>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-700 chrome:text-[#9fc6ad] uppercase">
                        {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    
                    <Link 
                      href={`/topic/${post.id}`}
                      className="block spray-hover"
                    >
                      <h3 className="text-xl font-black mb-2 uppercase tracking-wide text-black chrome:text-[#e6ffef]">{post.title}</h3>
                      <p className="text-sm font-semibold text-gray-700 chrome:text-[#c7ffd9] line-clamp-3 whitespace-pre-wrap">{post.body}</p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold">
                        <p className="text-orange-600 chrome:text-[#9dffc0] uppercase">→ クリックして詳細表示</p>
                        <div className="flex items-center gap-4 text-[1.08rem] leading-normal pt-0.5 pb-1 pr-1 overflow-visible">
                          <span className="flex items-center gap-2 text-blue-600 chrome:text-[#b8ffd1] leading-normal min-w-max">
                            {appTheme === "chrome" ? <ChromeMessageIcon size={21} /> : <HandDrawnCommentIcon size={21} className="overflow-visible shrink-0" />}
                            {post.commentCount || 0}
                          </span>
                          <span className="flex items-center gap-2 text-red-500 chrome:text-[#9dffc0] leading-normal min-w-max">
                            <HandDrawnHeartIcon size={21} className="overflow-visible shrink-0" />
                            {post.likes || 0}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {session && (
                      <div className="space-y-2">
                        {reviewByPostId[post.id] && (
                          <div className="p-3 rounded-lg border-2 border-black/80 chrome:border-[#3a7b56] bg-white/90 chrome:bg-[#132019]">
                            <p className="text-xs font-black uppercase text-gray-700 chrome:text-[#9dffc0] mb-1">AI講評</p>
                            <p className="text-sm font-semibold text-gray-800 chrome:text-[#e6ffef] whitespace-pre-wrap">
                              {reviewByPostId[post.id]}
                            </p>
                          </div>
                        )}

                        {reviewErrorByPostId[post.id] && (
                          <p className="text-xs font-bold text-red-600">{reviewErrorByPostId[post.id]}</p>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {session && (
        <button
          className={fab({ theme: appTheme })}
          onClick={onCreatePost}
          aria-label="投稿を作成"
        >
          <HandDrawnPlusIcon size={20} />
          投稿
        </button>
      )}
    </>
  );
}
