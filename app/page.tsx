"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppTheme } from "@/app/hooks/useAppTheme";
import { useIconUrl } from "@/app/hooks/useIconUrl";
import { 
  Button, 
  Spinner
} from "@/app/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/Tabs";
import { Users, AlertCircle, FileText, Target, MessageSquareText } from "lucide-react";
import { 
  HandDrawnSettingsIcon,
  LiquidMetalPostIcon,
  LiquidMetalTopicIcon,
  LiquidMetalBoardIcon,
  LiquidMetalPeopleIcon,
  ChromeSettingsIcon,
} from "@/app/components/HandDrawnIcons";
import { PostsTabContent } from "@/app/components/home/PostsTabContent";
import { TopicsTabContent } from "@/app/components/home/TopicsTabContent";
import { MembersTabContent } from "@/app/components/home/MembersTabContent";
import { BoardTabContent } from "@/app/components/home/BoardTabContent";
import { TopicDecisionModal } from "@/app/components/home/TopicDecisionModal";
import { ProposalModal } from "@/app/components/home/ProposalModal";
import { PostCreateModal } from "@/app/components/home/PostCreateModal";
import { usePosts } from "@/app/hooks/usePosts";
import { useUserProfile } from "@/app/hooks/useUserProfile";
import { tv } from "tailwind-variants";

const header = tv({
  base: "sticky top-0 p-4 z-30 mb-2",
  variants: {
    theme: {
      street: "bg-white shadow-street-hard-soft",
      chrome: "bg-linear-to-b from-black/75 via-black/45 to-transparent backdrop-blur-md shadow-street-hard-soft",
      library: "bg-white shadow-street-hard backdrop-blur-md",
    },
  },
});

const profileImage = tv({
  base: "w-12 h-12 rounded-full object-cover",
  variants: {
    theme: {
      street: "border-3 border-black shadow-street-hard",
      chrome: "border-2 border-white shadow-[0_2px_0_rgba(255,255,255,0.4)]",
      library: "border-2 border-library-border",
    },
  },
});

const profilePlaceholder = tv({
  base: "w-12 h-12 rounded-full flex items-center justify-center",
  variants: {
    theme: {
      street: "bg-yellow-300 border-3 border-black shadow-street-hard",
      chrome: "bg-gray-700 border-2 border-white",
      library: "bg-library-surface border-2 border-library-border",
    },
  },
});

export default function Home() {
  const { data: session, status } = useSession();
  const { appTheme } = useAppTheme();
  const [sessionLoadTimedOut, setSessionLoadTimedOut] = useState(false);
  const [isTopicDecisionModalOpen, setIsTopicDecisionModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "topics" | "board" | "members">("posts");

  // カスタムフック
  const {
    postsError,
    profilesError,
    postsLoading,
    mutatePosts,
  } = usePosts();

  const { userIcon } = useUserProfile(session ?? null);
  const iconUrl = useIconUrl(session?.user?.email, userIcon);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSessionLoadTimedOut(true);
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  if (status === "loading" && !sessionLoadTimedOut) {
    return <div className="p-10 text-center text-gray-500">読み込み中...</div>;
  }

  if (status === "loading" && sessionLoadTimedOut) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="text-gray-700 font-semibold">セッション確認に時間がかかっています</p>
        <p className="text-gray-500 text-sm">通信状況により認証確認が遅れる場合があります。</p>
        <div className="flex justify-center gap-2">
          <Button color="primary" onPress={() => window.location.reload()}>
            再読み込み
          </Button>
          <Button variant="flat" onPress={() => signIn("google")}>
            ログインし直す
          </Button>
        </div>
      </div>
    );
  }

  // ローディング状態
  if (postsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Spinner size="lg" color="primary" />
        <p className="mt-4 text-gray-500">データを読み込んでいます...</p>
      </div>
    );
  }

  // エラー状態
  if (postsError || profilesError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle size={48} className="text-danger mb-4" />
        <p className="text-lg font-semibold text-danger mb-2">データの取得に失敗しました</p>
        <p className="text-sm text-gray-500 mb-4">
          {postsError?.message || profilesError?.message || 'ネットワーク接続を確認してください'}
        </p>
        <Button 
          color="primary" 
          onPress={() => {
            mutatePosts();
          }}
        >
          再試行
        </Button>
      </div>
    );
  }

  return (
    <main className={`min-h-screen max-w-3xl mx-auto pb-40 relative z-10 ${appTheme === "library" ? "library-theme" : ""}`}>
      {/* ヘッダー */}
      <header className={header({ theme: appTheme })}>
        <div className="flex justify-between items-center">
          <h1 className="site-title leading-none">
            <span className="block text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-black/80 chrome:text-cyan-200">
              東京理科大学
            </span>
            <span className="block text-3xl font-black uppercase tracking-tight text-black chrome:text-cyan-300">
              文芸部
            </span>
          </h1>
          
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              aria-label="設定"
              className="w-12 h-12 rounded-full border-3 border-black bg-cyan-400 flex items-center justify-center shake-hover shadow-street-hard hover:translate-y-[-2px] hover:shadow-street-hard-hover transition-all"
            >
              {appTheme === "chrome" ? <ChromeSettingsIcon size={24} /> : <HandDrawnSettingsIcon size={22} />}
            </Link>

            {session ? (
              <Link href="/settings/profile" aria-label="アカウント設定" className="block">
                {iconUrl ? (
                  <img
                    src={iconUrl || ""}
                    alt="プロフィール"
                    className={profileImage({ theme: appTheme })}
                  />
                ) : (
                  <div className={profilePlaceholder({ theme: appTheme })} />
                )}
              </Link>
            ) : (
              <button 
                onClick={() => signIn("google")}
                className="h-10 px-4 rounded-full bg-pink-500 text-white font-black uppercase border-3 border-white shadow-street-hard hover:translate-y-[-2px] hover:shadow-street-hard-hover active:translate-y-[2px] active:shadow-street-hard-active transition-all shake-hover"
              >
                ログイン
              </button>
            )}
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as "posts" | "topics" | "board" | "members")}
      >
        <TabsList theme={appTheme} className="grid-cols-4">
          <TabsTrigger value="posts" theme={appTheme}>
            <span className="flex items-center gap-2">
              {appTheme === "chrome" ? (
                <FileText size={20} strokeWidth={2.5} className="text-white" />
              ) : (
                <span className="chrome-tab-icon-wrap">
                  <LiquidMetalPostIcon size={20} className="chrome-tab-icon" />
                </span>
              )}
              投稿
            </span>
          </TabsTrigger>

          <TabsTrigger value="topics" theme={appTheme}>
            <span className="flex items-center gap-2">
              {appTheme === "chrome" ? (
                <Target size={20} strokeWidth={2.5} className="text-white" />
              ) : (
                <span className="chrome-tab-icon-wrap">
                  <LiquidMetalTopicIcon size={20} className="chrome-tab-icon" />
                </span>
              )}
              お題
            </span>
          </TabsTrigger>

          <TabsTrigger value="board" theme={appTheme}>
            <span className="flex items-center gap-2">
              {appTheme === "chrome" ? (
                <MessageSquareText size={20} strokeWidth={2.5} className="text-white" />
              ) : (
                <span className="chrome-tab-icon-wrap">
                  <LiquidMetalBoardIcon size={20} className="chrome-tab-icon" />
                </span>
              )}
              掲示板
            </span>
          </TabsTrigger>

          <TabsTrigger value="members" theme={appTheme}>
            <span className="flex items-center gap-2">
              {appTheme === "chrome" ? (
                <Users size={20} strokeWidth={2.5} className="text-white" />
              ) : (
                <span className="chrome-tab-icon-wrap">
                  <LiquidMetalPeopleIcon size={20} className="chrome-tab-icon" />
                </span>
              )}
              部員紹介
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsTabContent
            onCreatePost={() => setIsPostModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="topics">
          <TopicsTabContent
            onOpenTopicDecision={() => setIsTopicDecisionModalOpen(true)}
            onCreateProposal={() => setIsProposalModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="board">
          <BoardTabContent />
        </TabsContent>

        <TabsContent value="members">
          <MembersTabContent />
        </TabsContent>
      </Tabs>

      <TopicDecisionModal
        isOpen={isTopicDecisionModalOpen}
        onClose={() => setIsTopicDecisionModalOpen(false)}
      />

      <ProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
      />

      <PostCreateModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />
    </main>
  );
}
