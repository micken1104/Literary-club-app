/**
 * Cloudflare R2 ユーティリティ関数
 * R2 からのテキストデータ取得や作品内容の管理
 */

interface R2ObjectMetadata {
  contentType: string;
  contentLength: number;
  httpMetadata?: {
    contentType?: string;
    contentEncoding?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    cacheControl?: string;
    expires?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface R2TextObject {
  path: string;
  text: string;
  metadata: R2ObjectMetadata;
}

/**
 * R2 からテキストを取得
 * @param path - R2 内のパス（例: "posts/2024-03-21/post-123.txt"）
 */
export async function getTextFromR2(path: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Missing Cloudflare credentials");
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/objects/get/${path}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch from R2: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`❌ R2 fetch error for ${path}:`, error);
    throw error;
  }
}

/**
 * 投稿データを構造化して取得
 * @param postId - 投稿ID
 * @param date - 投稿日（YYYY-MM-DD形式）
 */
export async function getPostContentFromR2(
  postId: string,
  date: string
): Promise<{ title: string; body: string }> {
  try {
    const path = `posts/${date}/${postId}.txt`;
    const content = await getTextFromR2(path);

    // txt ファイルは "title\n---\nbody" 形式と仮定
    const [title, ...bodyParts] = content.split("\n---\n");

    return {
      title: title.trim(),
      body: bodyParts.join("\n---\n").trim(),
    };
  } catch (error) {
    console.error(`❌ Failed to get post content for ${postId}:`, error);
    throw error;
  }
}

/**
 * メタデータ付きでテキストを R2 に保存
 * @param path - R2 内のパス
 * @param content - テキストコンテンツ
 * @param metadata - カスタムメタデータ
 */
export async function saveTextToR2(
  path: string,
  content: string,
  metadata?: Record<string, string>
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Missing Cloudflare credentials");
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/objects/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: content,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save to R2: ${response.statusText}`);
    }

    console.log(`✅ Saved to R2: ${path}`);
  } catch (error) {
    console.error(`❌ R2 save error for ${path}:`, error);
    throw error;
  }
}

/**
 * 複数の投稿を一括キャッシュ取得（ローカル DB 活用）
 * データベースから投稿リストを取得し、必要に応じて R2 から本文をフェッチ
 */
export async function getPostsWithContentFromDB(
  db: any,
  postIds: string[]
): Promise<Array<{ id: string; title: string; body: string; tag: string }>> {
  const placeholders = postIds.map(() => "?").join(",");

  const result = await db.execute({
    sql: `
      SELECT id, title, body, tag
      FROM posts
      WHERE id IN (${placeholders})
      ORDER BY createdAt DESC
    `,
    params: postIds,
  });

  if (!result.success) {
    throw new Error("Failed to fetch posts from DB");
  }

  return result.results || [];
}

/**
 * 日付範囲内の投稿を取得
 */
export async function getPostsByDateRange(
  db: any,
  startDate: number,
  endDate: number
): Promise<Array<{ id: string; title: string; body: string; tag: string; createdAt: number }>> {
  const result = await db.execute({
    sql: `
      SELECT id, title, body, tag, createdAt
      FROM posts
      WHERE createdAt BETWEEN ? AND ?
      AND isTopicPost = 0
      ORDER BY createdAt DESC
    `,
    params: [startDate, endDate],
  });

  if (!result.success) {
    throw new Error("Failed to fetch posts by date range");
  }

  return result.results || [];
}

/**
 * メンバーの投稿履歴を取得
 */
export async function getMemberPosts(
  db: any,
  memberEmail: string,
  limit = 10
): Promise<Array<{ id: string; title: string; body: string; tag: string }>> {
  const result = await db.execute({
    sql: `
      SELECT id, title, body, tag
      FROM posts
      WHERE authorEmail = ?
      AND isTopicPost = 0
      ORDER BY createdAt DESC
      LIMIT ?
    `,
    params: [memberEmail, limit],
  });

  if (!result.success) {
    throw new Error("Failed to fetch member posts");
  }

  return result.results || [];
}
