import { useCallback } from "react";
import useSWR from "swr";
import { hashEmail, R2_PUBLIC_URL, buildIconUrl } from "@/app/lib/imageUtils";

/**
 * 単一メールアドレスからアイコンURLを非同期で解決するフック
 */
export function useIconUrl(
  email: string | null | undefined,
  storedUrl?: string | null,
): string | null {
  const { data: hash } = useSWR(
    email && R2_PUBLIC_URL ? ["icon-hash", email] : null,
    ([, e]) => hashEmail(e),
  );

  // Prefer the stored URL (can contain cache-busting query params).
  if (storedUrl) return storedUrl;
  if (hash) return buildIconUrl(hash);
  return null;
}

/**
 * メール→保存URL マップから、非同期ハッシュ付きアイコンURL参照関数を返すフック
 */
export function useIconUrlMap(
  userIconMap: Record<string, string>,
): (email: string | null | undefined) => string | null {
  const emails = Object.keys(userIconMap);
  const sortedEmails = [...emails].sort();

  const { data: hashMap } = useSWR(
    sortedEmails.length > 0 && R2_PUBLIC_URL
      ? ["icon-hash-map", sortedEmails]
      : null,
    async ([, emailList]) => {
      const entries = await Promise.all(
        (emailList as string[]).map(async (email) => {
          const hash = await hashEmail(email);
          return [email, hash] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
  );

  return useCallback(
    (email: string | null | undefined): string | null => {
      if (!email) return null;
      const stored = userIconMap[email];
      if (stored) {
        return stored;
      }
      if (R2_PUBLIC_URL && hashMap?.[email]) {
        return buildIconUrl(hashMap[email]);
      }
      return null;
    },
    [hashMap, userIconMap],
  );
}
