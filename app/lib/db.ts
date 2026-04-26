/**
 * Cloudflare D1 REST API を使ったデータベースクライアント
 * 環境変数から認証情報を取得して D1 にアクセスします
 */

interface D1QueryOptions {
  sql: string;
  params?: (string | number | null)[];
}

interface D1Response<T = any> {
  success: boolean;
  results?: T[];
  error?: string;
  errors?: string[];
}

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;

  constructor(
    accountId: string,
    databaseId: string,
    apiToken: string
  ) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
  }

  private getApiUrl(): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
  }

  async execute<T = any>(options: D1QueryOptions): Promise<D1Response<T>> {
    try {
      const response = await fetch(`${this.getApiUrl()}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          sql: options.sql,
          params: options.params || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.errors?.[0] || 'Unknown error',
        };
      }

      const data = await response.json();
      return {
        success: data.success,
        results: data.result?.[0]?.results || [],
        errors: data.errors,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async insertPost(post: {
    id: string;
    title: string;
    subtitle?: string | null;
    body: string;
    author: string;
    authorEmail?: string | null;
    tag: string;
    createdAt: number;
    parentPostId?: string | null;
    isTopicPost?: number;
    deadline?: number | null;
  }) {
    // 現在のDBスキーマには subtitle カラムがないため、常に除外
    return this.execute({
      sql: `
        INSERT INTO posts (id, title, body, author, authorEmail, tag, createdAt, updatedAt, parentPostId, isTopicPost, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        post.id,
        post.title,
        post.body,
        post.author,
        post.authorEmail || null,
        post.tag,
        post.createdAt,
        Date.now(),
        post.parentPostId || null,
        post.isTopicPost || 0,
        post.deadline || null,
      ],
    });
  }

  async getPosts() {
    return this.execute({
      sql: `SELECT * FROM posts ORDER BY createdAt DESC`,
    });
  }

  async getTopicPosts() {
    return this.execute({
      sql: `SELECT * FROM posts WHERE isTopicPost = 1 ORDER BY createdAt DESC`,
    });
  }

  async getPostsByParentId(parentPostId: string) {
    return this.execute({
      sql: `SELECT * FROM posts WHERE parentPostId = ? ORDER BY createdAt ASC`,
      params: [parentPostId],
    });
  }

  async getPostById(id: string) {
    return this.execute({
      sql: `SELECT * FROM posts WHERE id = ?`,
      params: [id],
    });
  }

  async insertComment(comment: {
    postId: string;
    commentId: string;
    text: string;
    author: string;
    authorEmail?: string | null;
    createdAt: number;
  }) {
    return this.execute({
      sql: `
        INSERT INTO comments (postId, commentId, text, author, authorEmail, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        comment.postId,
        comment.commentId,
        comment.text,
        comment.author,
        comment.authorEmail || null,
        comment.createdAt,
      ],
    });
  }

  async getCommentsByPostId(postId: string) {
    return this.execute({
      sql: `SELECT * FROM comments WHERE postId = ? ORDER BY createdAt DESC`,
      params: [postId],
    });
  }

  async insertLike(postId: string, userId: string) {
    return this.execute({
      sql: `
        INSERT INTO likes (postId, userId, createdAt)
        VALUES (?, ?, ?)
        ON CONFLICT(postId, userId) DO NOTHING
      `,
      params: [postId, userId, Date.now()],
    });
  }

  async removeLike(postId: string, userId: string) {
    return this.execute({
      sql: `DELETE FROM likes WHERE postId = ? AND userId = ?`,
      params: [postId, userId],
    });
  }

  async getLikesCount(postId: string) {
    return this.execute({
      sql: `SELECT COUNT(*) as count FROM likes WHERE postId = ?`,
      params: [postId],
    });
  }

  async checkLike(postId: string, userId: string) {
    return this.execute({
      sql: `SELECT 1 FROM likes WHERE postId = ? AND userId = ? LIMIT 1`,
      params: [postId, userId],
    });
  }

  async deletePost(postId: string) {
    // 対象投稿を取得
    const targetPostResult = await this.execute<{ id: string; isTopicPost: number }>({
      sql: `SELECT id, isTopicPost FROM posts WHERE id = ? LIMIT 1`,
      params: [postId],
    });

    if (!targetPostResult.success || !targetPostResult.results || targetPostResult.results.length === 0) {
      return {
        success: false,
        error: "Post not found",
      };
    }

    const targetPost = targetPostResult.results[0] as any;

    // お題に投稿（返信）がある場合は削除禁止
    if (Number(targetPost.isTopicPost || 0) === 1) {
      const childCountResult = await this.execute<{ count: number }>({
        sql: `SELECT COUNT(*) as count FROM posts WHERE parentPostId = ?`,
        params: [postId],
      });

      if (!childCountResult.success) {
        return {
          success: false,
          error: childCountResult.error || "Failed to check topic children",
        };
      }

      const childCount = Number((childCountResult.results?.[0] as any)?.count || 0);
      if (childCount > 0) {
        return {
          success: false,
          error: "Topic with replies cannot be deleted",
        };
      }
    }

    // 投稿に紐づくコメントといいねを先に削除
    const deleteCommentsResult = await this.execute({
      sql: `DELETE FROM comments WHERE postId = ?`,
      params: [postId],
    });

    if (!deleteCommentsResult.success) {
      return {
        success: false,
        error: deleteCommentsResult.error || "Failed to delete related comments",
      };
    }

    const deleteLikesResult = await this.execute({
      sql: `DELETE FROM likes WHERE postId = ?`,
      params: [postId],
    });

    if (!deleteLikesResult.success) {
      return {
        success: false,
        error: deleteLikesResult.error || "Failed to delete related likes",
      };
    }

    return this.execute({
      sql: `DELETE FROM posts WHERE id = ?`,
      params: [postId],
    });
  }

  async updateComment(comment: {
    commentId: string;
    text: string;
    authorEmail: string;
    editedAt: number;
  }) {
    // まず、コメントの作成者が正しいか確認
    const checkResult = await this.execute({
      sql: `SELECT authorEmail FROM comments WHERE commentId = ?`,
      params: [comment.commentId],
    });

    if (!checkResult.success || !checkResult.results || checkResult.results.length === 0) {
      return {
        success: false,
        error: "Comment not found",
      };
    }

    const existingComment = checkResult.results[0] as any;
    if (existingComment.authorEmail !== comment.authorEmail) {
      return {
        success: false,
        error: "Unauthorized to edit this comment",
      };
    }

    // 更新を実行
    return this.execute({
      sql: `UPDATE comments SET text = ?, editedAt = ? WHERE commentId = ?`,
      params: [comment.text, comment.editedAt, comment.commentId],
    });
  }

  async deleteComment(comment: {
    commentId: string;
    authorEmail: string;
  }) {
    const checkResult = await this.execute({
      sql: `SELECT authorEmail FROM comments WHERE commentId = ?`,
      params: [comment.commentId],
    });

    if (!checkResult.success || !checkResult.results || checkResult.results.length === 0) {
      return {
        success: false,
        error: "Comment not found",
      };
    }

    const existingComment = checkResult.results[0] as any;
    if (existingComment.authorEmail !== comment.authorEmail) {
      return {
        success: false,
        error: "Unauthorized to delete this comment",
      };
    }

    return this.execute({
      sql: `DELETE FROM comments WHERE commentId = ?`,
      params: [comment.commentId],
    });
  }

  async updatePost(post: {
    postId: string;
    title: string;
    body: string;
    authorEmail: string;
    updatedAt: number;
  }) {
    // まず、投稿の作成者が正しいか確認
    const checkResult = await this.execute({
      sql: `SELECT authorEmail FROM posts WHERE id = ?`,
      params: [post.postId],
    });

    if (!checkResult.success || !checkResult.results || checkResult.results.length === 0) {
      return {
        success: false,
        error: "Post not found",
      };
    }

    const existingPost = checkResult.results[0] as any;
    if (existingPost.authorEmail !== post.authorEmail) {
      return {
        success: false,
        error: "Unauthorized to edit this post",
      };
    }

    // 更新を実行
    return this.execute({
      sql: `UPDATE posts SET title = ?, body = ?, updatedAt = ? WHERE id = ?`,
      params: [post.title, post.body, post.updatedAt, post.postId],
    });
  }

  async updateTopicDeadline(post: {
    postId: string;
    deadline: number | null;
    updatedAt: number;
  }) {
    const checkResult = await this.execute<{ isTopicPost: number }>({
      sql: `SELECT isTopicPost FROM posts WHERE id = ? LIMIT 1`,
      params: [post.postId],
    });

    if (!checkResult.success || !checkResult.results || checkResult.results.length === 0) {
      return {
        success: false,
        error: "Post not found",
      };
    }

    const existingPost = checkResult.results[0] as { isTopicPost: number };
    if (Number(existingPost.isTopicPost || 0) !== 1) {
      return {
        success: false,
        error: "Only topic posts can update deadline",
      };
    }

    return this.execute({
      sql: `UPDATE posts SET deadline = ?, updatedAt = ? WHERE id = ?`,
      params: [post.deadline, post.updatedAt, post.postId],
    });
  }
}

/**
 * 環境変数から D1Client を作成するヘルパー関数
 */
export function getD1Client(): D1Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'Missing Cloudflare environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN'
    );
  }

  return new D1Client(accountId, databaseId, apiToken);
}

export function getBoardD1Client(): D1Client {
  return getD1Client();
}
