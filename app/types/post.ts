export type Comment = {
  commentId: string;
  text: string;
  author: string;
  authorEmail?: string | null;
  createdAt: number;
  editedAt?: number | null;
};

export type Post = {
  id: string;
  author: string;
  authorEmail?: string | null;
  title: string;
  subtitle?: string;
  body: string;
  tag: string;
  createdAt: number;
  parentPostId?: string | null;
  isTopicPost?: number;
  deadline?: number | null;
  aiAnalysis?: string;
  aiAnalysisUpdatedAt?: number | null;
  comments?: Comment[];
  commentCount?: number;
  likes?: number;
  likesUserIds?: string[];
  children?: Post[];
};

export type MemberProfile = {
  email: string;
  penName: string;
  userIcon: string | null;
  selfIntro: string;
  aiSummary: string;
  aiTags: string[];
  updatedAt: number;
};
