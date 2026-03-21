import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getD1Client } from "@/app/lib/db";

export async function POST(request: Request) {
  try {
    const db = getD1Client();
    const data = await request.json();

    console.log("📝 受信したデータ:", data);

    const postId = uuidv4();
    
    // 基本的なポストデータ（subtitleなし）
    const postData: any = {
      id: postId,
      title: data.title,
      body: data.body,
      author: data.author,
      authorEmail: data.authorEmail || null,
      tag: data.tag || "創作",
      createdAt: Date.now(),
      parentPostId: data.parentPostId || null,
      isTopicPost: data.isTopicPost || 0,
      deadline: data.deadline || null,
    };
    
    const result = await db.insertPost(postData);

    console.log("📊 DB実行結果:", result);

    if (!result.success) {
      console.error("❌ DB保存失敗:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to save post" },
        { status: 500 }
      );
    }

    console.log("✅ D1 Save Success!");
    return NextResponse.json({ message: "Success", id: postId });
  } catch (error: any) {
    console.error("❌ D1 Save Error:", error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getD1Client();
    const result = await db.getPosts();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch posts" },
        { status: 500 }
      );
    }

    const posts = (result.results || []) as any[];

    if (posts.length === 0) {
      return NextResponse.json([]);
    }

    const postIds = posts.map((p) => p.id);
    const placeholders = postIds.map(() => "?").join(",");

    const [commentsAgg, likesAgg] = await Promise.all([
      db.execute<{ postId: string; count: number }>({
        sql: `
          SELECT postId, COUNT(*) as count
          FROM comments
          WHERE postId IN (${placeholders})
          GROUP BY postId
        `,
        params: postIds,
      }),
      db.execute<{ postId: string; count: number }>({
        sql: `
          SELECT postId, COUNT(*) as count
          FROM likes
          WHERE postId IN (${placeholders})
          GROUP BY postId
        `,
        params: postIds,
      }),
    ]);

    const commentCountMap = new Map<string, number>();
    const likesCountMap = new Map<string, number>();

    (commentsAgg.results || []).forEach((row: any) => {
      commentCountMap.set(row.postId, Number(row.count || 0));
    });

    (likesAgg.results || []).forEach((row: any) => {
      likesCountMap.set(row.postId, Number(row.count || 0));
    });

    const enrichedPosts = posts.map((post) => ({
      ...post,
      commentCount: commentCountMap.get(post.id) || 0,
      likes: likesCountMap.get(post.id) || 0,
    }));

    return NextResponse.json(enrichedPosts);
  } catch (error: any) {
    console.error("❌ D1 Fetch Error:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getD1Client();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 }
      );
    }

    const result = await db.deletePost(postId);

    if (!result.success) {
      const isTopicDeleteBlocked = result.error === "Topic with replies cannot be deleted";
      return NextResponse.json(
        { error: result.error || "Failed to delete post" },
        { status: isTopicDeleteBlocked ? 409 : 500 }
      );
    }

    console.log("✅ D1 Delete Success!");
    return NextResponse.json({ message: "Success" });
  } catch (error: any) {
    console.error("❌ D1 Delete Error:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const db = getD1Client();
    const data = await request.json();

    if (data.postId && Object.prototype.hasOwnProperty.call(data, "deadline")) {
      const result = await db.updateTopicDeadline({
        postId: data.postId,
        deadline: data.deadline === null ? null : Number(data.deadline),
        updatedAt: Date.now(),
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to update topic deadline" },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: "Success" });
    }

    if (!data.postId || !data.title || !data.body || !data.authorEmail) {
      return NextResponse.json(
        { error: "postId, title, body, and authorEmail are required" },
        { status: 400 }
      );
    }

    const result = await db.updatePost({
      postId: data.postId,
      title: data.title,
      body: data.body,
      authorEmail: data.authorEmail,
      updatedAt: Date.now(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update post" },
        { status: result.error === "Unauthorized to edit this post" ? 403 : 500 }
      );
    }

    console.log("✅ D1 Update Success!");
    return NextResponse.json({ message: "Success" });
  } catch (error: any) {
    console.error("❌ D1 Update Error:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}