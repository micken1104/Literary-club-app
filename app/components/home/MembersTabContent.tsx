"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAppTheme } from "@/app/hooks/useAppTheme";
import { Card, CardBody, Chip } from "@/app/components/ui";
import { Users } from "lucide-react";
import { usePosts } from "@/app/hooks/usePosts";
import { useIconUrlMap } from "@/app/hooks/useIconUrl";
import { useMemberAnalysis } from "@/app/hooks/useAIAnalysis";
import { tv } from "tailwind-variants";

const memberSection = tv({
  base: "",
  variants: {
    theme: {
      street: "rounded-lg bg-white chrome:bg-black border-3 border-black chrome:border-white p-3",
      chrome: "pt-3 border-t border-white/20",
      library: "rounded-xl bg-library-cream p-3 shadow-library-neu-inset-subtle",
    },
  },
});

const memberAiSection = tv({
  base: "",
  variants: {
    theme: {
      street: "rounded-lg bg-pink-200 chrome:bg-black border-3 border-black chrome:border-white p-3",
      chrome: "pt-3 border-t border-white/20",
      library: "rounded-xl bg-library-cream p-3 shadow-library-neu-inset-subtle",
    },
  },
});

export function MembersTabContent() {
  const { data: session } = useSession();
  const { appTheme } = useAppTheme();
  const { memberProfiles } = usePosts();

  const memberIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of memberProfiles) {
      if (m.email) map[m.email] = m.userIcon || "";
    }
    return map;
  }, [memberProfiles]);
  const getMemberIcon = useIconUrlMap(memberIconMap);

  const [aiReadingEnabled, setAiReadingEnabled] = useState(true);
  const [analysisByMemberKey, setAnalysisByMemberKey] = useState<Record<string, string>>({});
  const [tagsByMemberKey, setTagsByMemberKey] = useState<Record<string, string[]>>({});
  const requestedEmailsRef = useRef<Set<string>>(new Set());
  const { analyze } = useMemberAnalysis();

  useEffect(() => {
    memberProfiles.forEach((member) => {
      const email = member.email;
      if (!email || requestedEmailsRef.current.has(email)) {
        return;
      }

      if (
        member.aiSummary &&
        member.aiSummary.trim().length > 0 &&
        Array.isArray(member.aiTags) &&
        member.aiTags.length > 0
      ) {
        return;
      }

      requestedEmailsRef.current.add(email);

      void analyze({
        penName: member.penName || "部員",
        email,
        autoFetch: true,
        limit: 10,
      })
        .then((result) => {
          const analysis = (result as { analysis?: string } | undefined)?.analysis;
          const aiTags = (result as { aiTags?: string[] } | undefined)?.aiTags;
          if (analysis) {
            setAnalysisByMemberKey((prev) => ({
              ...prev,
              [email]: analysis,
            }));
          }
          if (aiTags && aiTags.length > 0) {
            setTagsByMemberKey((prev) => ({
              ...prev,
              [email]: aiTags.slice(0, 3),
            }));
          }
        })
        .catch(() => {
          // 失敗時は既存表示（プレースホルダ）を使う
        });
    });
  }, [memberProfiles, analyze]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lit-club-ai-reading-enabled");
      setAiReadingEnabled(saved !== "0");
    } catch {
      setAiReadingEnabled(true);
    }
  }, []);

  const sessionEmail = session?.user?.email;

  return (
    <div className="p-4 space-y-3">
      {memberProfiles.length === 0 ? (
        <Card shadow="sm" theme={appTheme}>
          <CardBody className="p-6 text-center space-y-2">
            <Users size={28} className="mx-auto text-default-400" />
            <p className="text-sm font-semibold text-default-600">部員プロフィールはまだありません</p>
            <p className="text-xs text-default-400">設定タブでペンネーム・自己紹介を登録すると表示されます。</p>
          </CardBody>
        </Card>
      ) : (
        memberProfiles.map((member) => {
          const iconUrl = getMemberIcon(member.email);
          const fallbackName = member.email ? member.email.split("@")[0] : "匿名部員";
          const displayName = member.penName || fallbackName;
          const displayTags = tagsByMemberKey[member.email] || (Array.isArray(member.aiTags) && member.aiTags.length > 0
            ? member.aiTags.slice(0, 3)
            : ["#文芸部", "#創作", "#部員紹介"]);

          return (
            <Link key={member.email} href={`/members/${encodeURIComponent(member.email)}`} className="block">
              <Card shadow="none" theme={appTheme}
                className={`${appTheme === "street" ? "bg-linear-to-br from-cyan-200 to-blue-300" : ""} hover:translate-y-[-2px] transition-transform`}
              >
                <CardBody className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={`${displayName}のアイコン`}
                      className="w-20 h-20 rounded-full object-cover border-2 border-black chrome:border-white shadow-street-hard-xs"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-yellow-300 border-2 border-black chrome:border-white shadow-street-hard-xs" />
                  )}
                  <p className="font-black text-xl uppercase tracking-wide text-black chrome:text-white">{displayName}</p>
                </div>

                <div className={memberSection({ theme: appTheme })}>
                  <p className="text-xs font-black uppercase text-black chrome:text-white mb-1">自己紹介</p>
                  <p className="text-sm font-semibold text-black chrome:text-white">{member.selfIntro || "未設定"}</p>
                </div>

                {(aiReadingEnabled || member.email !== sessionEmail) && (
                  <div className={memberAiSection({ theme: appTheme })}>
                    <p className="text-xs font-black uppercase text-black chrome:text-white mb-1">AI短文分析</p>
                    <p className="text-sm font-semibold text-black chrome:text-white">
                      {member.aiSummary || analysisByMemberKey[member.email] || "分析を作成中です..."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {displayTags.map((tag, index) => (
                    <Chip key={`${member.email}-${tag}-${index}`} size="md" className="bg-yellow-300 chrome:bg-black text-black chrome:text-white font-bold border-2 border-black chrome:border-white">
                      {tag}
                    </Chip>
                  ))}
                </div>
                </CardBody>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}
