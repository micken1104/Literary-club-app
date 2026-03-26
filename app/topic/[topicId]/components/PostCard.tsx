"use client";

import { useState } from "react";
import type { Post } from "@/app/types/post";
import { tv } from "tailwind-variants";
import { formatDateTime } from "@/app/lib/formatUtils";
import { useCommentMutations } from "@/app/hooks/useCommentMutations";
import { useLikeMutations } from "@/app/hooks/useLikeMutations";
import { UserIcon } from "./UserIcon";
import { VerticalTextDisplay } from "./VerticalTextDisplay";
import { PostActionButtons } from "./PostActionButtons";
import { CommentSection } from "./CommentSection";
import { CommentInput } from "./CommentInput";
import { EditPostForm } from "./EditPostForm";

const postCardStyle = tv({
  base: "p-6",
  variants: {
    theme: {
      street: "jsr-card bg-white rounded-2xl",
      chrome: "bg-transparent border-0 border-b border-white/25 rounded-none",
      library: "jsr-card bg-white rounded-2xl",
    },
    variant: {
      topic: "mb-8",
      reply: "mb-4",
    },
  },
});

interface PostCardProps {
  post: Post;
  variant: "topic" | "reply";
  appTheme: "street" | "chrome" | "library";
  // Auth
  session: { user?: { name?: string | null; email?: string | null } } | null;
  penName: string;
  // Edit
  onEditSave: (postId: string, title: string, body: string) => void;
  // User display
  iconCacheBust: number;
  getDisplayIcon: (email: string | null | undefined) => string | null | undefined;
  getDisplayName: (email: string | null | undefined, fallback: string) => string;
  // Actions
  onDelete: () => void;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  // Mutate
  mutateComments: () => void;
  mutateLikes: () => void;
}

function getAnonymousUserId(): string {
  const storageKey = "lit-club-anonymous-user-id";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return saved;

    const generated = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `anon-fallback-${Date.now()}`;
  }
}

function getDeadlineStatus(deadline: number | null | undefined) {
  if (!deadline) return null;

  const deadlineText = formatDateTime(deadline);

  const now = Date.now();
  const timeLeft = deadline - now;
  const hoursLeft = timeLeft / (1000 * 60 * 60);
  const daysLeft = timeLeft / (1000 * 60 * 60 * 24);

  if (timeLeft < 0) {
    return { status: "expired", label: `締切済 (${deadlineText})`, bgColor: "bg-gray-100", textColor: "text-gray-600" };
  } else if (hoursLeft < 24) {
    return { status: "urgent", label: `あと24時間 (締切: ${deadlineText})`, bgColor: "bg-red-100", textColor: "text-red-600" };
  } else if (daysLeft < 3) {
    return { status: "soon", label: `まもなく締切 (締切: ${deadlineText})`, bgColor: "bg-orange-100", textColor: "text-orange-600" };
  } else {
    return { status: "active", label: `締切: ${deadlineText}`, bgColor: "bg-blue-100", textColor: "text-blue-600" };
  }
}

export function PostCard({
  post,
  variant,
  appTheme,
  session,
  penName,
  onEditSave,
  iconCacheBust,
  getDisplayIcon,
  getDisplayName,
  onDelete,
  deleteDisabled,
  deleteDisabledReason,
  mutateComments,
  mutateLikes,
}: PostCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const cardClassName = postCardStyle({ theme: appTheme, variant });
  const sessionEmail = session?.user?.email;
  const isAuthor = sessionEmail === post.authorEmail;
  const userId = sessionEmail || getAnonymousUserId();
  const isLiked = post.likesUserIds?.includes(userId) ?? false;
  const likeParticipants = (post.likesUserIds || []).map((uid) => {
    const isMember = uid.includes("@");
    return {
      key: uid,
      icon: isMember ? (getDisplayIcon(uid) ?? null) : null,
      name: isMember ? getDisplayName(uid, "部員") : "ゲスト",
    };
  });

  const { handleLike } = useLikeMutations({
    session,
    getAnonymousUserId,
    mutateLikes,
  });

  const { saveComment, editComment, deleteComment } = useCommentMutations({
    session,
    penName,
    mutateComments,
  });

  const deadlineStatus = variant === "topic" ? getDeadlineStatus(post.deadline) : null;

  return (
    <div className={cardClassName}>
      {isEditing ? (
        <EditPostForm
          postId={post.id}
          initialTitle={post.title}
          initialBody={post.body}
          theme={appTheme}
          onSave={(postId, title, body) => {
            onEditSave(postId, title, body);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <div className="mb-4">
            {/* 締切バッジ（トピックのみ） */}
            {deadlineStatus && (
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-black mb-3 border-2 border-black chrome:border-green-500 ${deadlineStatus.bgColor} ${deadlineStatus.textColor}`}>
                {deadlineStatus.label}
              </div>
            )}

            <div className="mb-2">
              <h2 className="text-2xl font-black uppercase tracking-wide text-black chrome:text-green-300">
                {post.title}
              </h2>
            </div>

            {/* サブタイトル（トピックのみ） */}
            {variant === "topic" && post.subtitle && (
              <p className="text-sm text-gray-600 chrome:text-slate-200 mb-4 italic">{post.subtitle}</p>
            )}

            {/* 本文 */}
            {variant === "topic" && post.isTopicPost === 1 ? (
              <p className="text-gray-700 chrome:text-green-100 mb-4 whitespace-pre-wrap font-semibold">{post.body}</p>
            ) : (
              <VerticalTextDisplay
                body={post.body}
                className="mb-4 overflow-x-auto border-3 border-black chrome:border-green-700 rounded-xl p-4 bg-cyan-50 chrome:bg-gray-950 relative group"
                textClassName="text-black chrome:text-green-200 whitespace-pre-wrap font-semibold"
                hintClassName="hidden group-hover:flex absolute top-2 left-2 bg-cyan-600 chrome:bg-green-600 text-white chrome:text-black text-xs px-3 py-2 rounded-lg font-black uppercase pointer-events-none z-10 border-2 border-black chrome:border-green-500"
              />
            )}

            <div className="flex items-center justify-between text-sm font-bold mb-4">
              <span className="flex items-center gap-2">
                <UserIcon
                  src={getDisplayIcon(post.authorEmail)}
                  alt="投稿者アイコン"
                  size="sm"
                  cacheBust={iconCacheBust}
                />
                <span className="uppercase font-black text-black chrome:text-green-300">
                  {getDisplayName(post.authorEmail, post.author)}
                </span>
              </span>
              <span className="text-xs">
                {formatDateTime(post.createdAt)}
              </span>
            </div>

            <PostActionButtons
              likes={post.likes}
              isLiked={isLiked}
              participants={likeParticipants}
              isAuthor={isAuthor}
              onLike={() => handleLike(post.id, isLiked)}
              onEdit={() => setIsEditing(true)}
              onDelete={onDelete}
              deleteDisabled={deleteDisabled}
              deleteDisabledReason={deleteDisabledReason}
            />
          </div>
        </>
      )}

      <CommentSection
        comments={post.comments ?? []}
        appTheme={appTheme}
        sessionEmail={sessionEmail}
        iconCacheBust={iconCacheBust}
        getDisplayIcon={getDisplayIcon}
        getDisplayName={getDisplayName}
        onEditSave={editComment}
        onDelete={deleteComment}
      />

      <CommentInput
        theme={appTheme}
        onSubmit={(text) => saveComment(post.id, text)}
      />
    </div>
  );
}
