"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FRUITS } from "@/lib/fruits";

type PlayerSummary = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  bestScore: number;
  updatedAt: string | null;
  imageCount: number;
  hasAudio: boolean;
};

type PlayerDetail = PlayerSummary & {
  score: number;
  next: number;
  over: boolean;
  fruitCount: number;
  images: number[];
};

type PlayerPage = {
  players: PlayerSummary[];
  next: { before: string; beforeId: string } | null;
};

type Draft = {
  username: string;
  password: string;
  bestScore: string;
  score: string;
  next: string;
  over: boolean;
  clearFruits: boolean;
};

export function AdminDesk() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [query, setQuery] = useState("");
  const [nextPage, setNextPage] = useState<PlayerPage["next"]>(null);
  const [selected, setSelected] = useState<PlayerDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);

  async function loadPlayers(options?: { append?: boolean; query?: string }) {
    const q = options?.query ?? query;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (options?.append && nextPage) {
      params.set("before", nextPage.before);
      params.set("beforeId", nextPage.beforeId);
    }
    const response = await fetch(`/api/admin/players?${params.toString()}`);
    if (response.status === 401 || response.status === 403) {
      setAuthed(false);
      setPlayers([]);
      setNextPage(null);
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "玩家列表没有读出来");
      return false;
    }
    const body = (await response.json()) as PlayerPage;
    setPlayers((current) => (options?.append ? [...current, ...body.players] : body.players));
    setNextPage(body.next);
    setAuthed(true);
    return true;
  }

  useEffect(() => {
    void (async () => {
      await loadPlayers();
      setReady(true);
    })();
    // The desk loads the first page once. Search and "load more" call loadPlayers themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setPending(false);
      setMessage(body.error ?? "没有登录");
      return;
    }
    const allowed = await loadPlayers();
    setPending(false);
    if (!allowed) {
      await fetch("/api/auth/logout", { method: "POST" });
      setMessage("这个账号不是管理员");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    setSelected(null);
    setDraft(null);
    setPlayers([]);
  }

  async function openPlayer(id: string) {
    setMessage("");
    const response = await fetch(`/api/admin/players/${id}`);
    const body = (await response.json()) as { player?: PlayerDetail; error?: string };
    if (!response.ok || !body.player) {
      setMessage(body.error ?? "没有打开这个玩家");
      return;
    }
    setSelected(body.player);
    setDraft({
      username: body.player.username,
      password: "",
      bestScore: String(body.player.bestScore),
      score: String(body.player.score),
      next: String(body.player.next),
      over: body.player.over,
      clearFruits: false,
    });
  }

  async function savePlayer() {
    if (!selected || !draft) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/players/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: draft.username,
        password: draft.password,
        bestScore: Number(draft.bestScore),
        score: Number(draft.score),
        next: Number(draft.next),
        over: draft.over,
        clearFruits: draft.clearFruits,
      }),
    });
    const body = (await response.json()) as { player?: PlayerDetail; error?: string };
    setPending(false);
    if (!response.ok || !body.player) {
      setMessage(body.error ?? "没有保存");
      return;
    }
    setSelected(body.player);
    setDraft({
      username: body.player.username,
      password: "",
      bestScore: String(body.player.bestScore),
      score: String(body.player.score),
      next: String(body.player.next),
      over: body.player.over,
      clearFruits: false,
    });
    setMessage("已经保存");
    await loadPlayers();
  }

  async function removePlayer() {
    if (!selected || selected.isAdmin) return;
    if (!window.confirm(`删除玩家 ${selected.username}？存档和上传的素材会一起消失。`)) return;
    setPending(true);
    const response = await fetch(`/api/admin/players/${selected.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setMessage(body.error ?? "没有删除");
      return;
    }
    setSelected(null);
    setDraft(null);
    setMessage("已经删除");
    await loadPlayers();
  }

  async function removeImage(stage: number) {
    if (!selected) return;
    const response = await fetch(`/api/admin/players/${selected.id}/image/${stage}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "没有删掉这张图");
      return;
    }
    setSelected({ ...selected, images: selected.images.filter((item) => item !== stage) });
    await loadPlayers();
  }

  async function removeAudio() {
    if (!selected) return;
    const response = await fetch(`/api/admin/players/${selected.id}/audio`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "没有删掉音效");
      return;
    }
    setSelected({ ...selected, hasAudio: false });
    await loadPlayers();
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-6 text-[#3b2415]">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.22em] text-[#a56b45]">管理后台</p>
          <h1 className="font-display text-4xl leading-none">玩家数据</h1>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-full bg-[#fff8ee] px-4 py-2 text-sm shadow" href="/">
            回到游戏
          </Link>
          {authed ? (
            <button type="button" className="rounded-full bg-[#3b2415] px-4 py-2 text-sm text-[#fff8ee]" onClick={() => void logout()}>
              退出
            </button>
          ) : null}
        </div>
      </header>

      {!ready ? <p className="text-[#8a6248]">正在确认管理员身份…</p> : null}

      {ready && !authed ? (
        <form
          className="max-w-md space-y-3 rounded-3xl bg-[#fff8ee] p-5 shadow-[0_16px_40px_rgba(90,45,15,0.12)]"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <p className="text-sm leading-6 text-[#8a6248]">用管理员账号进入。用户名和密码都是 admin。</p>
          <input
            className="w-full rounded-2xl border border-[#ead8bf] bg-white px-4 py-3 outline-none"
            placeholder="用户名"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-[#ead8bf] bg-white px-4 py-3 outline-none"
            placeholder="密码"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={pending} className="w-full rounded-full bg-[#e25b45] py-3 font-semibold text-white disabled:opacity-50">
            登录
          </button>
        </form>
      ) : null}

      {authed ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-3xl bg-[#fff8ee] shadow-[0_16px_40px_rgba(90,45,15,0.12)]">
            <form
              className="flex gap-2 border-b border-[#ead8bf] px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                void loadPlayers({ query });
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-full border border-[#ead8bf] bg-white px-4 py-2 text-sm outline-none"
                placeholder="按用户名查找"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="rounded-full bg-[#f3e2cc] px-4 py-2 text-sm">
                查找
              </button>
            </form>
            <div className="border-b border-[#ead8bf] px-4 py-3 text-sm text-[#8a6248]">
              已显示 {players.length} 个账号{nextPage ? "，后面还有" : ""}
            </div>
            <ul className="divide-y divide-[#ead8bf]">
              {players.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left ${selected?.id === player.id ? "bg-[#fff1dc]" : ""}`}
                    onClick={() => void openPlayer(player.id)}
                  >
                    <span className="flex-1">
                      <span className="block font-semibold">
                        {player.username}
                        {player.isAdmin ? <span className="ml-2 text-xs font-normal text-[#a56b45]">管理员</span> : null}
                      </span>
                      <span className="text-xs text-[#a56b45]">
                        最高 {player.bestScore} · 图片 {player.imageCount} · {player.hasAudio ? "有音效" : "无音效"}
                      </span>
                    </span>
                    <span className="text-sm text-[#c2412d]">查看</span>
                  </button>
                </li>
              ))}
            </ul>
            {nextPage ? (
              <div className="border-t border-[#ead8bf] px-4 py-3">
                <button
                  type="button"
                  className="w-full rounded-full bg-[#f3e2cc] py-2 text-sm"
                  onClick={() => void loadPlayers({ append: true })}
                >
                  加载更多
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-[#fff8ee] p-4 shadow-[0_16px_40px_rgba(90,45,15,0.12)]">
            {selected && draft ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePlayer();
                }}
              >
                <div>
                  <h2 className="text-2xl font-semibold">{selected.username}</h2>
                  <p className="text-xs break-all text-[#a56b45]">{selected.id}</p>
                </div>
                <label className="block text-sm">
                  用户名
                  <input
                    className="mt-1 w-full rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                    value={draft.username}
                    disabled={selected.isAdmin}
                    onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                  />
                </label>
                {selected.isAdmin ? (
                  <p className="text-sm text-[#8a6248]">管理员密码固定是 admin。</p>
                ) : (
                  <label className="block text-sm">
                    新密码
                    <input
                      className="mt-1 w-full rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                      placeholder="留空表示不改"
                      value={draft.password}
                      onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    本局分数
                    <input
                      className="mt-1 w-full rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                      inputMode="numeric"
                      value={draft.score}
                      onChange={(event) => setDraft({ ...draft, score: event.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    最高分
                    <input
                      className="mt-1 w-full rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                      inputMode="numeric"
                      value={draft.bestScore}
                      onChange={(event) => setDraft({ ...draft, bestScore: event.target.value })}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  下一个水果（0 到 4）
                  <input
                    className="mt-1 w-full rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                    inputMode="numeric"
                    value={draft.next}
                    onChange={(event) => setDraft({ ...draft, next: event.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.over}
                    onChange={(event) => setDraft({ ...draft, over: event.target.checked })}
                  />
                  本局已经结束
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.clearFruits}
                    onChange={(event) => setDraft({ ...draft, clearFruits: event.target.checked })}
                  />
                  清空盘面（现在有 {selected.fruitCount} 个水果）
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={pending} className="flex-1 rounded-full bg-[#e25b45] py-2.5 font-semibold text-white disabled:opacity-50">
                    保存修改
                  </button>
                  {selected.isAdmin ? null : (
                    <button type="button" disabled={pending} className="rounded-full bg-[#3b2415] px-4 py-2.5 text-sm text-[#fff8ee] disabled:opacity-50" onClick={() => void removePlayer()}>
                      删除玩家
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">自定义图片</h3>
                  {selected.images.length === 0 ? <p className="text-sm text-[#a56b45]">没有换过图</p> : null}
                  <ul className="mt-2 space-y-2">
                    {selected.images.map((stage) => (
                      <li key={stage} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm">
                        <span>{FRUITS[stage]?.name ?? stage}</span>
                        <button type="button" className="text-[#c2412d]" onClick={() => void removeImage(stage)}>
                          删除
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">合成音效</h3>
                  {selected.hasAudio ? (
                    <button type="button" className="text-sm text-[#c2412d]" onClick={() => void removeAudio()}>
                      删除音效
                    </button>
                  ) : (
                    <span className="text-sm text-[#a56b45]">没有上传</span>
                  )}
                </div>
              </form>
            ) : (
              <p className="text-sm leading-6 text-[#8a6248]">从左边选一个玩家，可以改分数、用户名和密码，也可以删掉素材或整个账号。</p>
            )}
          </section>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-[#c2412d]">{message}</p> : null}
    </main>
  );
}
