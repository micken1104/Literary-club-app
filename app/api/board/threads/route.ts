import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getBoardD1Client } from "@/app/lib/db";

type BoardThreadRow = {
  id: string;
  title: string;
  body: string;
  author: string;
  authorEmail: string | null;
  createdAt: number;
  updatedAt: number;
  isClosed: number;
};

type CountRow = {
  threadId: string;
  count: number;
};

export async function GET() {
  try {
    const db = getBoardD1Client();

    const [threadsResult, countResult] = await Promise.all([
      db.execute<BoardThreadRow>({
        sql: "SELECT * FROM boardThreads ORDER BY updatedAt DESC",
      }),
      db.execute<CountRow>({
        sql: "SELECT threadId, COUNT(*) as count FROM boardComments GROUP BY threadId",
      }),
    ]);

    if (!threadsResult.success) {
      return NextResponse.json({ error: threadsResult.error || "Failed to fetch board threads" }, { status: 500 });
    }

    if (!countResult.success) {
      return NextResponse.json({ error: countResult.error || "Failed to fetch board thread counts" }, { status: 500 });
    }

    const countMap = new Map<string, number>();
    (countResult.results || []).forEach((row) => {
      countMap.set(row.threadId, Number(row.count || 0));
    });

    const enriched = (threadsResult.results || []).map((thread) => {
      const replyCount = countMap.get(thread.id) || 0;
      const totalEntries = replyCount + 1;
      const isClosed = Number(thread.isClosed || 0) === 1 || totalEntries >= 100;

      return {
        ...thread,
        replyCount,
        totalEntries,
        isClosed: isClosed ? 1 : 0,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getBoardD1Client();
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      author?: string;
      authorEmail?: string | null;
    };

    const title = String(body.title || "").trim();
    const threadBody = String(body.body || "").trim();
    const author = String(body.author || "匿名部員").trim() || "匿名部員";

    if (!title || !threadBody) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    const now = Date.now();
    const id = uuidv4();

    const result = await db.execute({
      sql: `
        INSERT INTO boardThreads (id, title, body, author, authorEmail, createdAt, updatedAt, isClosed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `,
      params: [id, title, threadBody, author, body.authorEmail || null, now, now],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to create board thread" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getBoardD1Client();
    const body = (await request.json()) as { threadId?: string };
    const threadId = String(body.threadId || "").trim();

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const existsResult = await db.execute<{ id: string }>({
      sql: "SELECT id FROM boardThreads WHERE id = ? LIMIT 1",
      params: [threadId],
    });

    if (!existsResult.success) {
      return NextResponse.json({ error: existsResult.error || "Failed to validate thread" }, { status: 500 });
    }

    if (!existsResult.results || existsResult.results.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const deleteCommentsResult = await db.execute({
      sql: "DELETE FROM boardComments WHERE threadId = ?",
      params: [threadId],
    });

    if (!deleteCommentsResult.success) {
      return NextResponse.json({ error: deleteCommentsResult.error || "Failed to delete board comments" }, { status: 500 });
    }

    const deleteThreadResult = await db.execute({
      sql: "DELETE FROM boardThreads WHERE id = ?",
      params: [threadId],
    });

    if (!deleteThreadResult.success) {
      return NextResponse.json({ error: deleteThreadResult.error || "Failed to delete board thread" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedThreadId: threadId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
