import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getBoardD1Client } from "@/app/lib/db";

type BoardCommentRow = {
  threadId: string;
  commentId: string;
  text: string;
  author: string;
  authorEmail: string | null;
  createdAt: number;
};

type CountRow = {
  count: number;
};

type ClosedRow = {
  isClosed: number;
};

export async function GET(request: Request) {
  try {
    const db = getBoardD1Client();
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const result = await db.execute<BoardCommentRow>({
      sql: "SELECT * FROM boardComments WHERE threadId = ? ORDER BY createdAt ASC",
      params: [threadId],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to fetch board comments" }, { status: 500 });
    }

    return NextResponse.json(result.results || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getBoardD1Client();
    const body = (await request.json()) as {
      threadId?: string;
      text?: string;
      author?: string;
      authorEmail?: string | null;
    };

    const threadId = String(body.threadId || "").trim();
    const text = String(body.text || "").trim();
    const author = String(body.author || "匿名部員").trim() || "匿名部員";

    if (!threadId || !text) {
      return NextResponse.json({ error: "threadId and text are required" }, { status: 400 });
    }

    const [closedResult, countResult] = await Promise.all([
      db.execute<ClosedRow>({
        sql: "SELECT isClosed FROM boardThreads WHERE id = ? LIMIT 1",
        params: [threadId],
      }),
      db.execute<CountRow>({
        sql: "SELECT COUNT(*) as count FROM boardComments WHERE threadId = ?",
        params: [threadId],
      }),
    ]);

    if (!closedResult.success || !closedResult.results || closedResult.results.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (!countResult.success) {
      return NextResponse.json({ error: countResult.error || "Failed to count comments" }, { status: 500 });
    }

    const alreadyClosed = Number(closedResult.results[0].isClosed || 0) === 1;
    const commentCount = Number((countResult.results?.[0]?.count || 0));
    const totalEntries = commentCount + 1;

    if (alreadyClosed || totalEntries >= 100) {
      await db.execute({
        sql: "UPDATE boardThreads SET isClosed = 1 WHERE id = ?",
        params: [threadId],
      });
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    const now = Date.now();
    const commentId = uuidv4();

    const insertResult = await db.execute({
      sql: `
        INSERT INTO boardComments (threadId, commentId, text, author, authorEmail, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [threadId, commentId, text, author, body.authorEmail || null, now],
    });

    if (!insertResult.success) {
      return NextResponse.json({ error: insertResult.error || "Failed to post board comment" }, { status: 500 });
    }

    const nextTotalEntries = totalEntries + 1;
    const closeFlag = nextTotalEntries >= 100 ? 1 : 0;

    const updateResult = await db.execute({
      sql: "UPDATE boardThreads SET updatedAt = ?, isClosed = ? WHERE id = ?",
      params: [now, closeFlag, threadId],
    });

    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error || "Failed to update board thread" }, { status: 500 });
    }

    return NextResponse.json({ success: true, commentId, closed: closeFlag === 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
