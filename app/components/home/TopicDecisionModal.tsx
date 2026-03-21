"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { HandDrawnTopicIcon } from "@/app/components/HandDrawnIcons";
import { usePosts } from "@/app/hooks/usePosts";
import { useUserProfile } from "@/app/hooks/useUserProfile";
import { useCreatePost } from "@/app/hooks/useCreatePost";
import type { Post } from "@/app/types/post";

type TopicDecisionModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TopicDecisionModal({ isOpen, onClose }: TopicDecisionModalProps) {
  const { data: session } = useSession();
  const { penName } = useUserProfile(session ?? null);
  const { topicPosts, topicProposals } = usePosts();
  const { trigger, isMutating } = useCreatePost();

  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selectedPoolTopicId, setSelectedPoolTopicId] = useState<string | null>(null);

  if (!isOpen) return null;

  const nowTimestamp = Date.now();
  const pastTopicPool = topicPosts.filter((topic: Post) => !!topic.deadline && topic.deadline < nowTimestamp);
  const decisionCandidates = [
    ...topicProposals.map((c) => ({ ...c, source: "proposal" as const })),
    ...pastTopicPool.map((c) => ({ ...c, source: "pool" as const })),
  ];
  const hasDecisionCandidates = topicProposals.length > 0 || pastTopicPool.length > 0;

  const selectedProposal = selectedProposalId
    ? topicProposals.find((p) => p.id === selectedProposalId) || null
    : null;
  const selectedPoolTopic = selectedPoolTopicId
    ? topicPosts.find((t) => t.id === selectedPoolTopicId) || null
    : null;
  const selectedDecisionCandidate = selectedProposal || selectedPoolTopic;

  const selectRandomCandidate = () => {
    if (decisionCandidates.length === 0) {
      alert("候補がまだありません");
      return;
    }
    const randomIndex = Math.floor(Math.random() * decisionCandidates.length);
    const randomCandidate = decisionCandidates[randomIndex];
    if (randomCandidate.source === "proposal") {
      setSelectedProposalId(randomCandidate.id);
      setSelectedPoolTopicId(null);
    } else {
      setSelectedPoolTopicId(randomCandidate.id);
      setSelectedProposalId(null);
    }
  };

  const handleConfirm = () => {
    const candidate = selectedProposal || selectedPoolTopic;
    if (!candidate) return;

    const topicData: Record<string, unknown> = selectedProposal
      ? { ...selectedProposal, isTopicPost: 1, deadline: null, tag: "お題" }
      : {
          title: candidate.title,
          body: candidate.body,
          tag: "お題",
          isTopicPost: 1,
          deadline: null,
          author: penName || session?.user?.name || "匿名部員",
          authorEmail: session?.user?.email || null,
        };

    trigger(topicData, {
      throwOnError: false,
      onSuccess: () => {
        alert("お題を追加しました！");
        setSelectedProposalId(null);
        setSelectedPoolTopicId(null);
        onClose();
      },
      onError: () => {
        alert("お題への変換に失敗しました");
      },
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 chrome:bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="library-topic-modal bg-white chrome:bg-gray-900 rounded-2xl border-4 border-white chrome:border-green-400 shadow-street-hard-lg-hover chrome:shadow-[0_0_30px_rgba(0,255,255,0.5)] max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="library-topic-modal-header rounded-t-[14px] flex justify-between items-center border-b-4 border-black chrome:border-green-400 p-6 bg-linear-to-r from-yellow-300 to-pink-400 chrome:bg-[#00FFFF]">
          <h2 className="text-2xl font-black uppercase flex items-center gap-2 text-black chrome:text-gray-900">
            <HandDrawnTopicIcon size={24} />
            お題を決定
          </h2>
          <button
            onClick={onClose}
            className="text-3xl font-black text-black chrome:text-gray-900 hover:text-red-600 chrome:hover:text-red-400 transition-colors"
          >
            ×
          </button>
        </div>

        {/* ボディ */}
        <div className="p-6 chrome:bg-gray-900 chrome:text-green-300">
          {!hasDecisionCandidates ? (
            <div className="text-center py-8">
              <p className="text-xl font-black uppercase text-black chrome:text-green-300">候補がまだありません</p>
              <p className="text-sm font-bold text-black/70 chrome:text-green-400 mt-2">
                「お題」タブ右下のボタンからお題案を投稿してください。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={selectRandomCandidate}
                    disabled={decisionCandidates.length === 0}
                    className="px-6 py-3 bg-orange-500 chrome:bg-green-600 text-white rounded-lg font-black uppercase border-3 border-white chrome:border-green-400 shadow-street-hard chrome:shadow-[0_0_15px_rgba(0,240,168,0.5)] hover:translate-y-[-2px] hover:shadow-street-hard-hover chrome:hover:shadow-[0_0_25px_rgba(0,240,168,0.7)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ランダム
                  </button>
                  <button
                    type="button"
                    disabled
                    title="AIお題作成は準備中です"
                    className="px-6 py-3 bg-sky-600 chrome:bg-gray-700 text-white chrome:text-gray-500 rounded-lg font-black uppercase opacity-50 cursor-not-allowed border-3 border-white chrome:border-gray-600"
                  >
                    生成AI (準備中)
                  </button>
                </div>

                <select
                  className="w-full border border-gray-300 chrome:border-green-400 rounded-lg px-3 py-2 bg-white chrome:bg-gray-900 text-slate-900 chrome:text-green-300 font-semibold"
                  value={selectedProposalId ? `proposal:${selectedProposalId}` : selectedPoolTopicId ? `pool:${selectedPoolTopicId}` : ""}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    if (!selectedValue) {
                      setSelectedProposalId(null);
                      setSelectedPoolTopicId(null);
                      return;
                    }
                    const [source, candidateId] = selectedValue.split(":");
                    if (source === "proposal") {
                      setSelectedProposalId(candidateId || null);
                      setSelectedPoolTopicId(null);
                      return;
                    }
                    setSelectedPoolTopicId(candidateId || null);
                    setSelectedProposalId(null);
                  }}
                >
                  <option value="">候補を選択</option>
                  {decisionCandidates.map((candidate) => (
                    <option key={`${candidate.source}-${candidate.id}`} value={`${candidate.source}:${candidate.id}`}>
                      {candidate.source === "proposal" ? "[お題案]" : "[過去お題]"} {candidate.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDecisionCandidate ? (
                <div className="rounded-lg border border-gray-200 chrome:border-green-400 bg-gray-50 chrome:bg-gray-900 p-3">
                  <p className="text-sm font-semibold text-slate-900 chrome:text-green-300">
                    {selectedDecisionCandidate.title}
                  </p>
                  <p className="text-xs text-slate-600 chrome:text-green-400 mt-1 line-clamp-4">
                    {selectedDecisionCandidate.body}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 chrome:text-green-400">
                  候補を選択してください。
                </p>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 border-t border-gray-200 chrome:border-green-400 p-6 chrome:bg-gray-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 chrome:text-green-300 hover:bg-gray-100 chrome:hover:bg-gray-800 chrome:hover:shadow-[0_0_10px_rgba(0,240,168,0.5)] rounded-lg font-semibold border border-transparent chrome:border-green-400 transition-all"
          >
            キャンセル
          </button>
          <button
            disabled={(!selectedProposalId && !selectedPoolTopicId) || isMutating}
            onClick={handleConfirm}
            className="px-6 py-3 bg-pink-500 chrome:bg-[#00FFFF] text-white chrome:text-gray-900 rounded-lg font-black uppercase border-3 border-white chrome:border-green-400 shadow-street-hard chrome:shadow-[0_0_20px_rgba(0,255,255,0.6)] hover:translate-y-[-2px] hover:shadow-street-hard-hover chrome:hover:shadow-[0_0_30px_rgba(0,255,255,0.8)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isMutating ? "処理中..." : "この内容でお題化"}
          </button>
        </div>
      </div>
    </div>
  );
}
