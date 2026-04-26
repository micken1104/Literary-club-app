"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { useSession } from "next-auth/react";
import { Search, Menu, X, RefreshCcw, Plus, Trash2 } from "lucide-react";
import { useUserProfile } from "@/app/hooks/useUserProfile";
import { cn } from "@/app/lib/cn";
import { fetcher } from "@/app/lib/fetchers";
import { Input, Textarea, Button } from "@/app/components/ui";
import type { Comment } from "@/app/types/post";

type BoardThread = {
  id: string;
  title: string;
  body: string;
  author: string;
  authorEmail?: string | null;
  createdAt: number;
  updatedAt: number;
  isClosed: number;
  replyCount: number;
  totalEntries: number;
};

type BoardEntry = {
  key: string;
  no: number;
  text: string;
  author: string;
  authorEmail?: string | null;
  createdAt: number;
  sourceType: "thread" | "comment";
};

const MAX_THREAD_ENTRIES = 100;

function hashToId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8).padEnd(8, "0");
}

function makeBoardId(author: string, authorEmail: string | null | undefined, createdAt: number): string {
  const day = new Date(createdAt).toISOString().slice(0, 10);
  return hashToId(`${authorEmail || author}-${day}`);
}

function includesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function parseInline(
  line: string,
  onAnchorClick: (no: number) => void,
  selectedAnchorNo: number | null,
): ReactNode[] {
  const pattern = /(>>\d+|\*\*[^*]+\*\*)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let matched: RegExpExecArray | null;

  while ((matched = pattern.exec(line)) !== null) {
    const token = matched[0];
    const start = matched.index;

    if (start > lastIndex) {
      result.push(line.slice(lastIndex, start));
    }

    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      result.push(
        <strong key={`b-${tokenIndex}`} className="font-bold text-black">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith(">>")) {
      const no = Number(token.slice(2));
      const isValid = Number.isInteger(no) && no > 0;

      if (!isValid) {
        result.push(token);
      } else {
        result.push(
          <button
            key={`a-${tokenIndex}`}
            type="button"
            onClick={() => onAnchorClick(no)}
            className={cn(
              "mx-0.5 rounded px-1 font-bold text-blue-700 underline decoration-blue-500 underline-offset-2 hover:bg-blue-100",
              selectedAnchorNo === no && "bg-yellow-100 text-red-700"
            )}
          >
            {token}
          </button>
        );
      }
    }

    tokenIndex += 1;
    lastIndex = start + token.length;
  }

  if (lastIndex < line.length) {
    result.push(line.slice(lastIndex));
  }

  return result;
}

function renderText(
  text: string,
  onAnchorClick: (no: number) => void,
  selectedAnchorNo: number | null,
): ReactNode {
  const lines = String(text || "").split("\n");

  return lines.map((line, lineIndex) => {
    const isQuote = /^\s*>/.test(line);
    const inline = parseInline(line, onAnchorClick, selectedAnchorNo);

    return (
      <Fragment key={`line-${lineIndex}`}>
        {lineIndex > 0 && <br />}
        {isQuote ? (
          <span className="text-green-700">{inline}</span>
        ) : (
          <>{inline}</>
        )}
      </Fragment>
    );
  });
}

export function BoardTabContent() {
  const { data: session } = useSession();
  const { penName } = useUserProfile(session ?? null);
  const {
    data: threadsData,
    isLoading: threadsLoading,
    mutate: mutateThreads,
  } = useSWR<BoardThread[]>("/api/board/threads", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const { trigger: triggerCreateThread, isMutating: isCreatingThread } = useSWRMutation(
    "/api/board/threads",
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "スレ立てに失敗しました。");
      }
      return data;
    }
  );

  const { trigger: triggerCreateComment } = useSWRMutation(
    "/api/board/comments",
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "書き込みに失敗しました。");
      }
      return data;
    }
  );

  const { trigger: triggerDeleteThread, isMutating: isDeletingThread } = useSWRMutation(
    "/api/board/threads",
    async (url: string, { arg }: { arg: { threadId: string } }) => {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "削除に失敗しました。");
      }
      return data;
    }
  );

  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [threadQuery, setThreadQuery] = useState("");
  const [searchInThread, setSearchInThread] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [threadTitleDraft, setThreadTitleDraft] = useState("");
  const [threadBodyDraft, setThreadBodyDraft] = useState("");
  const [showThreadForm, setShowThreadForm] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAnchorNo, setSelectedAnchorNo] = useState<number | null>(null);

  const threads = useMemo(() => {
    if (!Array.isArray(threadsData)) return [];
    return [...threadsData].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [threadsData]);

  const activeThreadId = selectedThreadId || threads[0]?.id || "";

  const selectedThread = useMemo(() => {
    return threads.find((thread) => thread.id === activeThreadId) || null;
  }, [activeThreadId, threads]);

  const commentsKey = selectedThread ? `/api/board/comments?threadId=${selectedThread.id}` : null;
  const {
    data: commentsData,
    mutate: mutateComments,
  } = useSWR<Comment[]>(commentsKey, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const comments = useMemo(() => {
    if (!Array.isArray(commentsData)) return [];
    return [...commentsData].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [commentsData]);

  const entries = useMemo((): BoardEntry[] => {
    if (!selectedThread) return [];

    const baseEntries: BoardEntry[] = [
      {
        key: `thread-${selectedThread.id}`,
        no: 1,
        text: selectedThread.body,
        author: selectedThread.author,
        authorEmail: selectedThread.authorEmail,
        createdAt: selectedThread.createdAt,
        sourceType: "thread",
      },
    ];

    comments.forEach((comment) => {
      baseEntries.push({
        key: `comment-${comment.commentId}`,
        no: baseEntries.length + 1,
        text: comment.text,
        author: comment.author,
        authorEmail: comment.authorEmail,
        createdAt: comment.createdAt,
        sourceType: "comment",
      });
    });

    return baseEntries;
  }, [selectedThread, comments]);

  const isThreadClosed = entries.length >= MAX_THREAD_ENTRIES;

  const filteredEntries = useMemo(() => {
    const query = searchInThread.trim();
    if (!query) return entries;

    return entries.filter((entry) => {
      return (
        includesQuery(entry.text, query) ||
        includesQuery(entry.author, query) ||
        includesQuery(String(entry.no), query)
      );
    });
  }, [entries, searchInThread]);

  const visibleThreads = useMemo(() => {
    const query = threadQuery.trim();
    if (!query) return threads;

    return threads.filter((thread) => {
      const titleHit = includesQuery(thread.title, query);
      const bodyHit = includesQuery(thread.body, query);
      const authorHit = includesQuery(thread.author, query);
      return titleHit || bodyHit || authorHit;
    });
  }, [threads, threadQuery]);

  const handleAnchorClick = (no: number) => {
    setSelectedAnchorNo(no);
    const target = document.getElementById(`board-entry-${no}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    }
    window.setTimeout(() => setSelectedAnchorNo(null), 1800);
  };

  const handleReplySubmit = () => {
    if (!selectedThread) return;
    if (!session?.user?.email) {
      alert("ログインすると書き込みできます。");
      return;
    }
    if (isThreadClosed) {
      alert("このスレッドは100到達のためクローズされています。");
      return;
    }
    const trimmed = replyDraft.trim();
    if (!trimmed) return;

    triggerCreateComment(
      {
        threadId: selectedThread.id,
        text: trimmed,
        author: penName || session.user.name || "匿名部員",
        authorEmail: session.user.email,
      },
      {
        throwOnError: false,
        onSuccess: () => {
          setReplyDraft("");
          void mutateComments();
          void mutateThreads();
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : "書き込みに失敗しました。");
        },
      }
    );
  };

  const handleShowLatest = () => {
    const latestNo = entries[entries.length - 1]?.no;
    if (!latestNo) return;
    const target = document.getElementById(`board-entry-${latestNo}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  const handleCreateThread = () => {
    if (!session?.user?.email) {
      alert("ログインするとスレ立てできます。");
      return;
    }

    const title = threadTitleDraft.trim();
    const body = threadBodyDraft.trim();
    if (!title || !body) {
      alert("タイトルと本文を入力してください。");
      return;
    }

    triggerCreateThread(
      {
        title,
        body,
        author: penName || session.user.name || "匿名部員",
        authorEmail: session.user.email,
        tag: "掲示板",
      },
      {
        throwOnError: false,
        onSuccess: () => {
          setThreadTitleDraft("");
          setThreadBodyDraft("");
          setShowThreadForm(false);
          void mutateThreads();
        },
        onError: () => {
          alert("スレ立てに失敗しました。");
        },
      }
    );
  };

  const handleDeleteThread = () => {
    if (!selectedThread) return;

    const shouldDelete = window.confirm("このスレッドを削除しますか？\n本文とレスはすべてデータベースから削除されます。");
    if (!shouldDelete) return;

    triggerDeleteThread(
      { threadId: selectedThread.id },
      {
        throwOnError: false,
        onSuccess: () => {
          if (selectedThreadId === selectedThread.id) {
            setSelectedThreadId("");
          }
          setSearchInThread("");
          setReplyDraft("");
          void mutateComments([]);
          void mutateThreads();
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : "削除に失敗しました。");
        },
      }
    );
  };

  return (
    <section className="p-3 md:p-4">
      <div className="rounded-md border-2 border-[#777] bg-[#efefef] text-[#111] shadow-[2px_2px_0_#fff,-2px_-2px_0_#c7c7c7] chrome:border-[#4fff9c] chrome:bg-[#0b0f0d] chrome:text-[#e6ffef] chrome:shadow-[0_0_0_transparent]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#a9a9a9] bg-[#d9d9d9] px-3 py-2 text-sm md:px-4 chrome:border-[#2c6b46] chrome:bg-[#111a15]">
          <div className="flex items-center gap-2 font-mono text-xs md:text-sm">
            <span className="text-[#333] chrome:text-[#b8ffd1]">自動更新: 10秒</span>
            {session?.user?.email ? (
              <span className="rounded border border-[#2f5f2f] bg-[#e7f6e7] px-2 py-0.5 text-[11px] font-bold text-[#1a5f1a] md:text-xs">
                ログイン済み部員
              </span>
            ) : (
              <span className="rounded border border-[#845757] bg-[#f8e7e7] px-2 py-0.5 text-[11px] font-bold text-[#7a1f1f] md:text-xs">
                閲覧モード
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleShowLatest}
                className="inline-flex items-center gap-1 rounded border border-[#7a5f26] bg-[#fff6d8] px-2 py-1 text-xs font-bold text-[#7a5f26] hover:bg-[#fff0bf] chrome:border-[#4aa86a] chrome:bg-[#143021] chrome:text-[#9dffc0] chrome:hover:bg-[#1a3f2b]"
              >
                <RefreshCcw size={13} />
                最新へ
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1 rounded border border-[#666] bg-white px-2 py-1 text-xs font-bold md:hidden chrome:border-[#458f62] chrome:bg-[#122119] chrome:text-[#c7ffd9]"
              aria-label="スレ一覧を開閉"
            >
              {isDrawerOpen ? <X size={14} /> : <Menu size={14} />}
              スレ一覧
            </button>
          </div>
        </header>

        <div className="grid min-h-[70vh] grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#a9a9a9] bg-[#f6f6f6] md:block chrome:border-[#2c6b46] chrome:bg-[#111712]">
            <div className="border-b border-[#d0d0d0] p-3 chrome:border-[#2c6b46]">
              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#666] chrome:text-[#90d2a8]" />
                <Input
                  value={threadQuery}
                  onValueChange={setThreadQuery}
                  placeholder="スレッド検索"
                  className="h-9 border-[#989898] bg-white pl-8 text-sm chrome:border-[#3a7b56] chrome:bg-[#0f1813] chrome:text-[#e6ffef]"
                />
              </label>
            </div>
            <div className="max-h-[calc(70vh-58px)] overflow-y-auto">
              {visibleThreads.length === 0 && (
                <p className="px-3 py-6 text-xs text-[#555] chrome:text-[#9cc8ad]">該当スレッドがありません。</p>
              )}
              {visibleThreads.map((thread) => {
                const isActive = selectedThreadId === thread.id;
                const count = Number(thread.totalEntries || 1);
                const isClosed = Number(thread.isClosed || 0) === 1 || count >= MAX_THREAD_ENTRIES;

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setIsDrawerOpen(false);
                    }}
                    className={cn(
                      "block w-full border-b border-[#ddd] px-3 py-2 text-left font-mono text-sm hover:bg-[#ececec] chrome:border-[#274f39] chrome:hover:bg-[#18231d]",
                      isActive && "bg-[#dde9ff] chrome:bg-[#1d3a29]"
                    )}
                  >
                    <p className="line-clamp-1 text-[13px] font-bold text-[#003] chrome:text-[#d5ffe4]">{thread.title}</p>
                    <p className="mt-1 text-[11px] text-[#444] chrome:text-[#9fc6ad]">
                      {thread.author} / {count}レス
                      {isClosed ? " / クローズ" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {isDrawerOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setIsDrawerOpen(false)}>
              <div
                className="h-full w-[86%] max-w-[320px] border-r border-[#888] bg-[#f6f6f6] chrome:border-[#2d5a40] chrome:bg-[#111712]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="border-b border-[#d0d0d0] p-3 chrome:border-[#2d5a40]">
                  <label className="relative block">
                    <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#666] chrome:text-[#90d2a8]" />
                    <Input
                      value={threadQuery}
                      onValueChange={setThreadQuery}
                      placeholder="スレッド検索"
                      className="h-9 border-[#989898] bg-white pl-8 text-sm chrome:border-[#3a7b56] chrome:bg-[#0f1813] chrome:text-[#e6ffef]"
                    />
                  </label>
                </div>
                <div className="max-h-[calc(100vh-58px)] overflow-y-auto">
                  {visibleThreads.map((thread) => {
                    const isActive = selectedThreadId === thread.id;
                    const count = Number(thread.totalEntries || 1);
                    const isClosed = Number(thread.isClosed || 0) === 1 || count >= MAX_THREAD_ENTRIES;

                    return (
                      <button
                        key={`mobile-${thread.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedThreadId(thread.id);
                          setIsDrawerOpen(false);
                        }}
                        className={cn(
                          "block w-full border-b border-[#ddd] px-3 py-2 text-left font-mono text-sm chrome:border-[#274f39]",
                          isActive ? "bg-[#dde9ff] chrome:bg-[#1d3a29]" : "hover:bg-[#ececec] chrome:hover:bg-[#18231d]"
                        )}
                      >
                        <p className="line-clamp-1 text-[13px] font-bold text-[#003] chrome:text-[#d5ffe4]">{thread.title}</p>
                        <p className="mt-1 text-[11px] text-[#444] chrome:text-[#9fc6ad]">
                          {thread.author} / {count}レス
                          {isClosed ? " / クローズ" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <main className="flex min-h-[70vh] flex-col bg-white chrome:bg-[#0f1411]">
            {threadsLoading && !selectedThread ? (
              <div className="px-4 py-10 text-sm text-[#555] chrome:text-[#9cc8ad]">読み込み中...</div>
            ) : !selectedThread ? (
              <div className="px-4 py-10 text-sm text-[#555] chrome:text-[#9cc8ad]">表示できるスレッドがありません。</div>
            ) : (
              <>
                <div className="border-b border-[#ddd] bg-[#fafafa] px-4 py-3 chrome:border-[#2a523b] chrome:bg-[#141d18]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-mono text-sm font-bold text-[#111] md:text-base chrome:text-[#e2ffec]">{selectedThread.title}</h3>
                    <button
                      type="button"
                      onClick={handleDeleteThread}
                      disabled={isDeletingThread}
                      className="inline-flex items-center gap-1 rounded border border-[#8c3f3f] bg-[#fde7e7] px-2 py-1 text-xs font-bold text-[#8c1f1f] hover:bg-[#fbd6d6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={12} />
                      {isDeletingThread ? "削除中" : "スレ削除"}
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[#444] chrome:text-[#9fc6ad]">
                    作成: {selectedThread.author} / {new Date(selectedThread.createdAt).toLocaleString("ja-JP")}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#7a1f1f]">
                    {isThreadClosed
                      ? `このスレは ${MAX_THREAD_ENTRIES} 到達のためクローズされています。`
                      : `レス上限: ${MAX_THREAD_ENTRIES}（現在 ${entries.length}）`}
                  </p>
                  <div className="mt-2">
                    <label className="relative block max-w-sm">
                      <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#666] chrome:text-[#90d2a8]" />
                      <Input
                        value={searchInThread}
                        onValueChange={setSearchInThread}
                        placeholder="このスレを検索"
                        className="h-8 border-[#a0a0a0] pl-7 text-xs chrome:border-[#3a7b56] chrome:bg-[#0f1813] chrome:text-[#e6ffef]"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 md:px-4">
                  {filteredEntries.length === 0 ? (
                    <p className="py-6 text-sm text-[#555] chrome:text-[#9cc8ad]">検索条件に一致するレスがありません。</p>
                  ) : (
                    filteredEntries.map((entry) => {
                      const id = makeBoardId(entry.author, entry.authorEmail, entry.createdAt);
                      const isHighlighted = selectedAnchorNo === entry.no;

                      return (
                        <div
                          key={entry.key}
                          id={`board-entry-${entry.no}`}
                          tabIndex={-1}
                          className={cn(
                            "rounded border border-[#d0d0d0] px-3 py-2 text-sm font-mono leading-6 chrome:border-[#305f45]",
                            isHighlighted ? "bg-[#fff7d6] chrome:bg-[#1a2e22]" : "bg-white chrome:bg-[#111915]"
                          )}
                        >
                          <p className="mb-1 text-xs font-bold text-[#0f3a7a]">
                            {entry.no} 名前: {entry.author} ID:{id}
                            <span className="ml-2 text-[#555] chrome:text-[#a0c9af]">{new Date(entry.createdAt).toLocaleString("ja-JP")}</span>
                            <span className="ml-2 rounded border border-[#bbb] bg-[#f2f2f2] px-1 text-[10px] text-[#555] chrome:border-[#3a7b56] chrome:bg-[#132019] chrome:text-[#9cc8ad]">
                              {entry.sourceType === "thread" ? "本文" : "コメント"}
                            </span>
                          </p>
                          <div className="break-words text-[13px] text-[#111] chrome:text-[#e8fff0]">
                            {renderText(entry.text, handleAnchorClick, selectedAnchorNo)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-[#ccc] bg-[#f7f7f7] px-3 py-3 md:px-4 chrome:border-[#2a523b] chrome:bg-[#141d18]">
                  <p className="mb-2 text-xs text-[#444] chrome:text-[#9fc6ad]">記法: 引用は行頭 &gt; 、太字は **文字** 、アンカーは &gt;&gt;番号</p>
                  <Textarea
                    value={replyDraft}
                    onValueChange={setReplyDraft}
                    rows={4}
                    placeholder={
                      !session?.user?.email
                        ? "ログインするとレスできます"
                        : isThreadClosed
                        ? "このスレはクローズ済みです"
                        : "レスを書く（最大500文字推奨）"
                    }
                    disabled={!session?.user?.email || isThreadClosed}
                    className="border-[#989898] bg-white text-sm chrome:border-[#3a7b56] chrome:bg-[#0f1813] chrome:text-[#e6ffef]"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-[#666] chrome:text-[#9fc6ad]">{replyDraft.length} 文字</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="flat"
                        onPress={() => {
                          setReplyDraft("");
                        }}
                        isDisabled={!session?.user?.email || isThreadClosed || replyDraft.length === 0}
                        className="h-8 border border-[#999] bg-white px-3 text-xs font-bold text-[#333]"
                      >
                        クリア
                      </Button>
                      <Button
                        onPress={handleReplySubmit}
                        isDisabled={!session?.user?.email || isThreadClosed || replyDraft.trim().length === 0}
                        className="h-8 border border-[#2b5a2b] bg-[#e4f4e4] px-4 text-xs font-bold text-[#215321]"
                      >
                        書き込む
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {session?.user?.email && (
        <button
          type="button"
          onClick={() => setShowThreadForm((prev) => !prev)}
          className="fixed right-6 bottom-24 z-40 inline-flex h-14 items-center gap-2 rounded-full border-4 border-white bg-yellow-400 px-5 text-base font-black uppercase text-black shadow-[0_8px_0_rgba(0,0,0,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgba(0,0,0,0.9)] active:translate-y-[2px] active:shadow-[0_6px_0_rgba(0,0,0,0.9)]"
          aria-label="新規スレ立て"
        >
          <Plus size={18} strokeWidth={2.8} />
          スレ立て
        </button>
      )}

      {showThreadForm && session?.user?.email && (
        <div className="fixed inset-0 z-50 bg-black/45 p-4" onClick={() => setShowThreadForm(false)}>
          <div
            className="mx-auto mt-18 w-full max-w-xl rounded-xl border-4 border-white bg-[#f2f2f2] p-4 shadow-[0_12px_0_rgba(0,0,0,0.85)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-3 font-mono text-sm font-bold text-[#1b1b1b]">新規スレッド作成</p>
            <div className="space-y-2">
              <Input
                value={threadTitleDraft}
                onValueChange={setThreadTitleDraft}
                maxLength={80}
                placeholder="タイトル"
                className="h-10 border-[#989898] bg-white text-sm"
              />
              <Textarea
                value={threadBodyDraft}
                onValueChange={setThreadBodyDraft}
                maxLength={1200}
                rows={6}
                placeholder="本文（引用は > 、太字は **文字**）"
                className="border-[#989898] bg-white text-sm"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="flat"
                onPress={() => setShowThreadForm(false)}
                className="h-9 border border-[#999] bg-white px-4 text-xs font-bold text-[#333]"
              >
                閉じる
              </Button>
              <Button
                onPress={handleCreateThread}
                isDisabled={!threadTitleDraft.trim() || !threadBodyDraft.trim() || isCreatingThread}
                className="h-9 border border-[#2b5a2b] bg-[#e4f4e4] px-4 text-xs font-bold text-[#215321]"
              >
                {isCreatingThread ? "作成中..." : "スレ立て"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
