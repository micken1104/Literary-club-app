import { useCallback } from "react";
import useSWRMutation from "swr/mutation";

async function postFetcher(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "リクエストに失敗しました");
  }
  return res.json();
}

async function patchFetcher(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "更新に失敗しました" }));
    throw new Error(data.error || "更新に失敗しました");
  }
  return res.json();
}

async function deletePostFetcher(url: string, { arg }: { arg: { postId: string } }) {
  const res = await fetch(`${url}?postId=${encodeURIComponent(arg.postId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("削除に失敗しました");
  }
  return res.json();
}

type UsePostMutationsParams = {
  session: { user?: { name?: string | null; email?: string | null } } | null;
  penName: string;
  mutatePosts: () => void;
};

export function usePostMutations({
  session,
  penName,
  mutatePosts,
}: UsePostMutationsParams) {
  const { trigger: triggerCreateReply, isMutating: isCreatingReply } =
    useSWRMutation("/api/posts", postFetcher);
  const { trigger: triggerEditPost } = useSWRMutation("/api/posts", patchFetcher);
  const { trigger: triggerDeletePost } = useSWRMutation("/api/posts", deletePostFetcher);

  const saveReply = useCallback(
    (
      parentPostId: string,
      newPost: { title?: string; body?: string; tag?: string },
      onSuccess?: () => void,
    ) => {
      if (!newPost.title || !newPost.body) {
        alert("タイトルと本文を入力してください");
        return;
      }

      triggerCreateReply(
        {
          title: newPost.title,
          body: newPost.body,
          author: penName || session?.user?.name || "匿名部員",
          authorEmail: session?.user?.email || null,
          tag: newPost.tag || "創作",
          parentPostId,
          isTopicPost: 0,
        },
        {
          onSuccess: () => {
            alert("投稿しました！");
            mutatePosts();
            onSuccess?.();
          },
          onError: (error) => {
            console.error("投稿エラー:", error);
            alert("投稿に失敗しました");
          },
        }
      );
    },
    [triggerCreateReply, penName, session, mutatePosts]
  );

  const saveEditedPost = useCallback(
    (postId: string, title: string, body: string) => {
      if (!title.trim() || !body.trim()) {
        alert("タイトルと内容は必須です");
        return;
      }

      triggerEditPost(
        {
          postId,
          title,
          body,
          authorEmail: session?.user?.email,
        },
        {
          onSuccess: () => {
            alert("更新しました！");
            mutatePosts();
          },
          onError: (error) => {
            console.error("編集エラー:", error);
            alert(
              error instanceof Error
                ? `更新に失敗しました: ${error.message}`
                : "編集に失敗しました"
            );
          },
        }
      );
    },
    [triggerEditPost, session, mutatePosts]
  );

  const toggleTopicDeadline = useCallback(
    (postId: string, deadline: number | null, onSuccess?: () => void) => {
      triggerEditPost(
        {
          postId,
          deadline,
        },
        {
          onSuccess: () => {
            mutatePosts();
            onSuccess?.();
          },
          onError: (error) => {
            console.error("締め切り更新エラー:", error);
            alert("締め切り更新に失敗しました");
          },
        }
      );
    },
    [triggerEditPost, mutatePosts]
  );

  const deletePost = useCallback(
    (postId: string, onSuccess?: () => void) => {
      if (!confirm("本当に削除しますか？")) return;

      triggerDeletePost(
        { postId },
        {
          onSuccess: () => {
            mutatePosts();
            onSuccess?.();
          },
          onError: (error) => {
            console.error("削除エラー:", error);
          },
        }
      );
    },
    [triggerDeletePost, mutatePosts]
  );

  return {
    saveReply,
    isCreatingReply,
    saveEditedPost,
    toggleTopicDeadline,
    deletePost,
  };
}
