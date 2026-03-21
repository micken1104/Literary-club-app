import { NextResponse } from "next/server";
import { getD1Client } from "@/app/lib/db";
import { formatDateTime } from "@/app/lib/formatUtils";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// プッシュ通知を送信（Cloudflare Workers Cronから呼ばれる想定）
export async function POST(request: Request) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VAPID keys are not configured" },
        { status: 503 }
      );
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const db = getD1Client();
    const data = await request.json();
    const { userEmail, title, body, url, tag } = data;

    if (!userEmail || !title) {
      return NextResponse.json(
        { error: "userEmail and title are required" },
        { status: 400 }
      );
    }

    // ユーザーの全サブスクリプションを取得
    const result = await db.execute({
      sql: `SELECT endpoint, keys FROM pushSubscriptions WHERE userEmail = ?`,
      params: [userEmail],
    });

    if (!result.success || !result.results || result.results.length === 0) {
      return NextResponse.json(
        { error: "No subscriptions found for this user" },
        { status: 404 }
      );
    }

    const subscriptions = result.results as Array<{ endpoint: string; keys: string }>;

    // 各サブスクリプションに通知を送信
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const keys = JSON.parse(sub.keys);
        const payload = JSON.stringify({
          title,
          body: body || "",
          url: url || "/",
          tag: tag || "default",
        });

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: keys.p256dh,
              auth: keys.auth,
            },
          },
          payload
        );

        return { success: true, endpoint: sub.endpoint };
      } catch (error: any) {
        const statusCode = error?.statusCode;

        // 期限切れサブスクリプションはDBから削除
        if (statusCode === 404 || statusCode === 410) {
          await db.execute({
            sql: `DELETE FROM pushSubscriptions WHERE endpoint = ?`,
            params: [sub.endpoint],
          });
        }

        console.error("Failed to send notification:", statusCode, error?.message || error);
        return {
          success: false,
          endpoint: sub.endpoint,
          statusCode: statusCode || 500,
          error: error?.message || "Unknown error",
        };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Sent ${successCount} of ${results.length} notifications`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 締め切りチェック用エンドポイント（Cronから定期実行）
export async function GET() {
  try {
    const db = getD1Client();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const nowUtcMs = Date.now();
    const nowJst = new Date(nowUtcMs + jstOffsetMs);
    const nowSec = Math.floor(nowUtcMs / 1000);
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const nowJstHour = nowJst.getUTCHours();
    const nowJstMinute = nowJst.getUTCMinutes();
    const nowJstDay = nowJst.getUTCDay();

    // JST正午: 既存の締切通知
    const shouldRunNoonDeadlinePush = nowJstHour === 12 && nowJstMinute <= 10;
    // JST月曜00時: 部員紹介AI自動更新
    const shouldRunMondayMemberAi = nowJstDay === 1 && nowJstHour === 0 && nowJstMinute <= 15;

    if (!shouldRunNoonDeadlinePush && !shouldRunMondayMemberAi) {
      return NextResponse.json({
        message: "Skipped: not scheduled window",
        shouldRunNoonDeadlinePush,
        shouldRunMondayMemberAi,
        jstDay: nowJstDay,
        jstHour: nowJstHour,
        jstMinute: nowJstMinute,
      });
    }

    const getJstDayRange = (offsetDays: number) => {
      const targetJst = new Date(nowJst);
      targetJst.setUTCDate(targetJst.getUTCDate() + offsetDays);

      const year = targetJst.getUTCFullYear();
      const month = targetJst.getUTCMonth();
      const day = targetJst.getUTCDate();

      const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - jstOffsetMs;
      const endUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - jstOffsetMs;
      return { startUtcMs, endUtcMs };
    };

    const resultPayload: Record<string, unknown> = {
      shouldRunNoonDeadlinePush,
      shouldRunMondayMemberAi,
      jstDay: nowJstDay,
      jstHour: nowJstHour,
      jstMinute: nowJstMinute,
    };

    if (shouldRunNoonDeadlinePush) {
      const threeDaysRange = getJstDayRange(3);
      const todayRange = getJstDayRange(0);

      // 締切3日前のお題を取得（JST日付基準）
      const threeDaysBeforeResult = await db.execute({
        sql: `SELECT id, title, author, authorEmail, deadline FROM posts
              WHERE isTopicPost = 1 AND deadline IS NOT NULL
              AND deadline >= ? AND deadline <= ?`,
        params: [threeDaysRange.startUtcMs, threeDaysRange.endUtcMs],
      });

      // 締切当日のお題を取得（JST日付基準）
      const todayResult = await db.execute({
        sql: `SELECT id, title, author, authorEmail, deadline FROM posts
              WHERE isTopicPost = 1 AND deadline IS NOT NULL
              AND deadline >= ? AND deadline <= ?`,
        params: [todayRange.startUtcMs, todayRange.endUtcMs],
      });

      const threeDaysBeforeTopics = (threeDaysBeforeResult.results || []) as Array<{
        id: string;
        title: string;
        authorEmail: string;
        deadline: number;
      }>;

      const todayTopics = (todayResult.results || []) as Array<{
        id: string;
        title: string;
        authorEmail: string;
        deadline: number;
      }>;

      const notifications: Array<{ userEmail: string; title: string; body: string; url: string }> = [];

      for (const topic of threeDaysBeforeTopics) {
        notifications.push({
          userEmail: topic.authorEmail,
          title: "締め切り3日前",
          body: `「${topic.title}」の締め切りは ${formatDateTime(topic.deadline)} です`,
          url: `/topic/${topic.id}`,
        });
      }

      for (const topic of todayTopics) {
        notifications.push({
          userEmail: topic.authorEmail,
          title: "締め切り当日",
          body: `「${topic.title}」の締め切りは本日 ${formatDateTime(topic.deadline)} です`,
          url: `/topic/${topic.id}`,
        });
      }

      for (const notification of notifications) {
        await fetch(`${baseUrl}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notification),
        });
      }

      resultPayload.deadlinePush = {
        sentCount: notifications.length,
        threeDaysBefore: threeDaysBeforeTopics.length,
        today: todayTopics.length,
      };
    }

    if (shouldRunMondayMemberAi) {
      const profilesResult = await db.execute({
        sql: `SELECT email, penName, allowAiRead
              FROM userProfiles
              WHERE COALESCE(allowAiRead, 1) = 1`,
      });

      const profiles = (profilesResult.results || []) as Array<{
        email: string;
        penName: string;
      }>;

      let memberUpdatedCount = 0;
      const memberErrors: string[] = [];

      for (const profile of profiles) {
        try {
          const res = await fetch(`${baseUrl}/api/analysis/member`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: profile.email,
              penName: profile.penName || "部員",
              autoFetch: true,
              limit: 10,
              forceRefresh: true,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            memberErrors.push(`${profile.email}: ${errorText}`);
            continue;
          }

          const data = (await res.json()) as { analysis?: string };
          const compactSummary = String(data.analysis || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 75);

          if (!compactSummary) {
            continue;
          }

          await db.execute({
            sql: `UPDATE userProfiles
                  SET aiSummary = ?,
                      aiUpdatedAt = ?,
                      updatedAt = strftime('%s', 'now')
                  WHERE email = ?`,
            params: [compactSummary, nowSec, profile.email],
          });
          memberUpdatedCount += 1;
        } catch (error) {
          memberErrors.push(`${profile.email}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      resultPayload.weeklyAi = {
        memberCandidateCount: profiles.length,
        memberUpdatedCount,
        memberErrorCount: memberErrors.length,
      };
    }

    return NextResponse.json(resultPayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
