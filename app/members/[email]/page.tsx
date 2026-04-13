"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppTheme } from "@/app/hooks/useAppTheme";
import { usePosts } from "@/app/hooks/usePosts";
import { Card, CardBody, Chip } from "@/app/components/ui";
import { Save } from "lucide-react";
import {
  HandDrawnCommentIcon,
  HandDrawnHeartIcon,
  ChromeMessageIcon,
} from "@/app/components/HandDrawnIcons";

export default function MemberPostsPage() {
  const params = useParams<{ email: string }>();
  const { appTheme } = useAppTheme();
  const { allPosts, postsLoading, memberProfiles, getDisplayIcon, getDisplayName } = usePosts();

  const memberEmail = useMemo(() => {
    const raw = String(params?.email || "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params?.email]);

  const memberProfile = useMemo(
    () => memberProfiles.find((profile) => profile.email === memberEmail) || null,
    [memberProfiles, memberEmail],
  );

  const memberName = memberProfile?.penName || (memberEmail.includes("@") ? memberEmail.split("@")[0] : "部員");

  const memberPosts = useMemo(
    () =>
      allPosts
        .filter((post) => post.authorEmail === memberEmail)
        .filter((post) => post.isTopicPost !== 1)
        .filter((post) => post.tag !== "お題案")
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [allPosts, memberEmail],
  );

  return (
    <main className="min-h-screen max-w-3xl mx-auto">
      <header className="sticky top-0 z-20 bg-white/90 chrome:bg-black/90 backdrop-blur-md border-b-3 border-black chrome:border-white p-4 flex items-center gap-4">
        <Link
          href="/"
          className="p-2 rounded-full transition-colors text-black chrome:text-white hover:bg-black/10 chrome:hover:bg-white/10"
          aria-label="戻る"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide text-black chrome:text-white">{memberName} の投稿一覧</h1>
          <p className="text-xs font-bold text-gray-700 chrome:text-gray-300">{memberPosts.length} 件</p>
        </div>
      </header>

      <div className="p-3 space-y-3">
        {postsLoading ? (
          <p className="text-center text-gray-500 chrome:text-gray-300 py-8 font-semibold">読み込み中...</p>
        ) : memberPosts.length === 0 ? (
          <div className="p-10 text-center">
            <Save size={34} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-sm font-medium">この部員の投稿はまだありません</p>
          </div>
        ) : (
          memberPosts.map((post) => (
            <Card
              key={post.id}
              shadow="none"
              theme={appTheme}
              className={appTheme !== "chrome" ? "bg-white" : ""}
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
                    <span className="font-black text-base uppercase text-black chrome:text-green-300">
                      {getDisplayName(post.authorEmail, post.author)}
                    </span>
                    <Chip
                      size="md"
                      theme={appTheme}
                      className={appTheme !== "library" ? "bg-cyan-400 text-black font-bold border-2 border-black" : ""}
                    >
                      自由投稿
                    </Chip>
                  </div>
                  <span className="text-xs font-bold text-gray-700 chrome:text-gray-300 uppercase">
                    {new Date(post.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>

                <Link
                  href={`/topic/${post.id}`}
                  className="block spray-hover"
                >
                  <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-black chrome:text-green-200">
                    {post.title}
                  </h2>
                  <p className="text-sm font-semibold text-gray-700 chrome:text-green-100 line-clamp-3 whitespace-pre-wrap">
                    {post.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold">
                    <p className="text-orange-600 chrome:text-yellow-300 uppercase">→ クリックして詳細表示</p>
                    <div className="flex items-center gap-4 text-[1.08rem] leading-normal pt-0.5 pb-1 pr-1 overflow-visible">
                      <span className="flex items-center gap-2 text-blue-600 chrome:text-cyan-400 leading-normal min-w-max">
                        {appTheme === "chrome" ? <ChromeMessageIcon size={21} /> : <HandDrawnCommentIcon size={21} className="overflow-visible shrink-0" />}
                        {post.commentCount || 0}
                      </span>
                      <span className="flex items-center gap-2 text-red-500 chrome:text-pink-400 leading-normal min-w-max">
                        <HandDrawnHeartIcon size={21} className="overflow-visible shrink-0" />
                        {post.likes || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
