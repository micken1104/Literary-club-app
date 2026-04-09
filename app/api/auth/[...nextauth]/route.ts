import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function ensureUserProfileOnSignIn(email: string, name: string | null | undefined): Promise<void> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    return;
  }

  const d1Url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
  const fallbackPenName =
    (name && name.trim().length > 0 ? name.trim().slice(0, 20) : email.split("@")[0] || "部員");

  const execute = async (sql: string, params: Array<string | number | null>) => {
    const response = await fetch(d1Url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `D1 request failed: ${response.status}`);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid D1 response");
    }

    if (data?.success === false || data?.result?.[0]?.success === false) {
      throw new Error(data?.errors?.[0]?.message || data?.result?.[0]?.error || "D1 query failed");
    }
  };

  try {
    await execute(
      `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, allowAiRead, createdAt, updatedAt)
       VALUES (?, ?, NULL, '', 1, strftime('%s','now'), strftime('%s','now'))
       ON CONFLICT(email) DO UPDATE SET
         penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
         updatedAt = strftime('%s','now')`,
      [email, fallbackPenName]
    );
  } catch {
    // Backward compatibility for schema before allowAiRead column
    await execute(
      `INSERT INTO userProfiles (email, penName, userIcon, selfIntro, createdAt, updatedAt)
       VALUES (?, ?, NULL, '', strftime('%s','now'), strftime('%s','now'))
       ON CONFLICT(email) DO UPDATE SET
         penName = COALESCE(NULLIF(userProfiles.penName, ''), excluded.penName),
         updatedAt = strftime('%s','now')`,
      [email, fallbackPenName]
    );
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  // セキュリティ設定（後で部員のみに絞る設定をここに追加できます）
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) {
        return false;
      }

      try {
        await ensureUserProfileOnSignIn(user.email, user.name);
      } catch (error) {
        console.error("Failed to ensure profile on sign-in:", error);
      }

      return true;
    },
  },
});

export { handler as GET, handler as POST };