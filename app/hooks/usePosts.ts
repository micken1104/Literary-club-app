import { useMemo } from "react";
import useSWR from "swr";
import type { Post, MemberProfile } from "@/app/types/post";
import { fetcher, profilesFetcher } from "@/app/lib/fetchers";
import { useIconUrlMap } from "@/app/hooks/useIconUrl";

export function usePosts() {
  const {
    data: allPostsData,
    error: postsError,
    isLoading: postsLoading,
    mutate: mutatePosts,
  } = useSWR<Post[]>("/api/posts", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  const {
    data: memberProfilesData,
    error: profilesError,
  } = useSWR("/api/profiles", fetcher, {
    refreshInterval: 60000,
  });

  // 投稿者のメールアドレスリストを導出
  const emailsFromPosts = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    const emails = new Set<string>();
    allPostsData.forEach((post) => {
      if (post.authorEmail) emails.add(post.authorEmail);
    });
    return Array.from(emails).sort();
  }, [allPostsData]);

  // ペンネーム・アイコンマップを SWR で取得
  const { data: penNameData } = useSWR(
    emailsFromPosts.length > 0 ? ["/api/profiles", emailsFromPosts] : null,
    profilesFetcher
  );
  const penNameMap: Record<string, string> = penNameData?.penNameMap || {};
  const userIconMap: Record<string, string> = penNameData?.userIconMap || {};

  // 投稿データを useMemo で分類
  const allPosts = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    return [...allPostsData].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }, [allPostsData]);

  const topicPosts = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    const topics = allPostsData
      .filter((p) => p.isTopicPost === 1)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return topics.map((topic) => ({
      ...topic,
      children: allPostsData.filter((p) => p.parentPostId === topic.id),
    }));
  }, [allPostsData]);

  const topicProposals = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    return allPostsData
      .filter((p) => p.tag === "お題案" && p.isTopicPost !== 1)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allPostsData]);

  const freePosts = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    return allPostsData
      .filter(
        (p) => !p.parentPostId && p.isTopicPost !== 1 && p.tag !== "お題案"
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allPostsData]);

  const topicReplies = useMemo(() => {
    if (!allPostsData || !Array.isArray(allPostsData)) return [];
    return allPostsData
      .filter((p) => p.parentPostId && p.isTopicPost !== 1)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allPostsData]);

  const memberProfiles: MemberProfile[] = useMemo(() => {
    if (!memberProfilesData) return [];
    const profiles = Array.isArray(memberProfilesData.profiles)
      ? [...memberProfilesData.profiles]
      : [];

    const posts = Array.isArray(allPostsData) ? allPostsData : [];
    const postCountByEmail = new Map<string, number>();

    posts.forEach((post) => {
      const email = String(post.authorEmail || "").trim();
      if (!email) return;
      if (post.isTopicPost === 1) return;
      if (post.tag === "お題案") return;
      postCountByEmail.set(email, (postCountByEmail.get(email) || 0) + 1);
    });

    profiles.sort((a, b) => {
      const countA = postCountByEmail.get(a.email) || 0;
      const countB = postCountByEmail.get(b.email) || 0;
      if (countA !== countB) {
        return countB - countA;
      }
      return String(a.penName || a.email).localeCompare(String(b.penName || b.email), "ja");
    });

    return profiles;
  }, [memberProfilesData, allPostsData]);

  const getDisplayName = (
    authorEmail: string | null | undefined,
    authorName: string
  ) => {
    if (authorEmail && penNameMap[authorEmail]) {
      return penNameMap[authorEmail];
    }
    return authorName;
  };

  const getDisplayIcon = useIconUrlMap(userIconMap);

  const getTopicParticipants = (topic: Post) => {
    const seen = new Set<string>();
    const participants: Array<{
      key: string;
      name: string;
      icon: string | null;
    }> = [];

    (topic.children || []).forEach((child) => {
      const key = child.authorEmail || `name:${child.author}`;
      if (seen.has(key)) return;

      seen.add(key);
      participants.push({
        key,
        name: getDisplayName(child.authorEmail, child.author),
        icon: getDisplayIcon(child.authorEmail),
      });
    });

    return participants;
  };

  return {
    allPosts,
    topicPosts,
    topicProposals,
    freePosts,
    topicReplies,
    memberProfiles,
    penNameMap,
    userIconMap,
    postsError,
    profilesError,
    postsLoading,
    mutatePosts,
    getDisplayName,
    getDisplayIcon,
    getTopicParticipants,
  };
}
