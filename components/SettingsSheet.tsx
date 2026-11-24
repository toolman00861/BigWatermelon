"use client";

import { useState } from "react";
import { FRUITS } from "@/lib/fruits";

export type AccountUser = { id: string; username: string };

type Props = {
  open: boolean;
  database: boolean | null;
  user: AccountUser | null;
  imageUrls: (string | null)[];
  hasAudio: boolean;
  onClose: () => void;
  onUser: (user: AccountUser | null) => void;
  onImage: (stage: number, url: string | null) => void;
  onAudio: (buffer: ArrayBuffer | null) => void;
};

export function SettingsSheet({
  open,
  database,
  user,
  imageUrls,
  hasAudio,
  onClose,
  onUser,
  onImage,
  onAudio,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(path: "/api/auth/login" | "/api/auth/register") {
    setPending(true);
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json()) as {
      user?: AccountUser;
      error?: string;
    };
    setPending(false);
    if (!response.ok || !body.user) {
      setMessage(body.error ?? "没有完成");
      return;
    }
    setPassword("");
    setMessage("");
    onUser(body.user);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onUser(null);
  }

  async function upload(url: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(url, { method: "POST", body: form });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "上传没有完成");
      return false;
    }
    setMessage("");
    return true;
  }

  return (
    <div
      className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-[#3b2415]/35 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-label="关闭设置"
      />
      <aside
        className={`absolute top-0 right-0 flex h-full w-full max-w-[420px] flex-col bg-[#fff8ee] text-[#3b2415] shadow-[-20px_0_60px_rgba(80,40,10,0.18)] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[#ead8bf] px-5 py-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#a56b45]">设置</p>
            <h2 className="font-display text-3xl leading-none">合成大西瓜</h2>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#f3e2cc] text-lg"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="rounded-3xl bg-[#fff1dc] p-4">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[#8a6248]">已登录</p>
                  <p className="text-xl font-semibold">{user.username}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-[#3b2415] px-4 py-2 text-sm text-[#fff8ee]"
                  onClick={logout}
                >
                  退出
                </button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit("/api/auth/login");
                }}
              >
                <p className="text-sm leading-6 text-[#8a6248]">
                  不登录也能玩。登录后可以把每一级的图片和合成音效换成自己的，存档也会跟这个账号走。
                </p>
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
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pending || database === false}
                    className="flex-1 rounded-full bg-[#e25b45] py-3 font-semibold text-white disabled:opacity-50"
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    disabled={pending || database === false}
                    className="flex-1 rounded-full bg-[#3b2415] py-3 font-semibold text-[#fff8ee] disabled:opacity-50"
                    onClick={() => void submit("/api/auth/register")}
                  >
                    注册
                  </button>
                </div>
              </form>
            )}
            {database === false ? (
              <p className="mt-3 text-sm leading-6 text-[#a56b45]">
                还没有 DATABASE_URL。基础版可以先玩，登录要等数据库接上。
              </p>
            ) : null}
            {message ? <p className="mt-3 text-sm text-[#c2412d]">{message}</p> : null}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">每一级的样子</h3>
              <p className="text-sm leading-6 text-[#8a6248]">
                碰撞仍然是这一级固定的圆。图片会居中铺进圆里。
              </p>
            </div>
            <ul className="space-y-2">
              {FRUITS.map((fruit, stage) => (
                <li
                  key={fruit.name}
                  className="flex items-center gap-3 rounded-2xl border border-[#ead8bf] bg-white px-3 py-2"
                >
                  <span
                    className="grid h-11 w-11 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ background: fruit.flesh }}
                  >
                    {stage + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{fruit.name}</span>
                    <span className="text-xs text-[#a56b45]">
                      {imageUrls[stage] ? "已换成自己的图" : "内置画法"}
                    </span>
                  </span>
                  <label className="cursor-pointer rounded-full bg-[#f3e2cc] px-3 py-2 text-sm">
                    更换
                    <input
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={!user}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const ok = await upload(`/api/custom/image/${stage}`, file);
                        if (ok) onImage(stage, `/api/custom/image/${stage}?v=${Date.now()}`);
                      }}
                    />
                  </label>
                  {imageUrls[stage] ? (
                    <button
                      type="button"
                      className="text-sm text-[#a56b45]"
                      onClick={async () => {
                        await fetch(`/api/custom/image/${stage}`, { method: "DELETE" });
                        onImage(stage, null);
                      }}
                    >
                      恢复
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 pb-6">
            <div>
              <h3 className="text-lg font-semibold">合成音效</h3>
              <p className="text-sm leading-6 text-[#8a6248]">
                合成结果越大，这一声越低、越慢。最小是 1.0 倍，合成出西瓜时是 0.7 倍。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full bg-[#3b2415] px-4 py-2 text-sm text-[#fff8ee]">
                {hasAudio ? "更换音频" : "上传音频"}
                <input
                  className="hidden"
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg"
                  disabled={!user}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const ok = await upload("/api/custom/audio", file);
                    if (!ok) return;
                    onAudio(await file.arrayBuffer());
                  }}
                />
              </label>
              {hasAudio ? (
                <button
                  type="button"
                  className="rounded-full bg-[#f3e2cc] px-4 py-2 text-sm"
                  onClick={async () => {
                    await fetch("/api/custom/audio", { method: "DELETE" });
                    onAudio(null);
                  }}
                >
                  用回内置音效
                </button>
              ) : (
                <span className="text-sm text-[#a56b45]">当前是内置轻弹</span>
              )}
            </div>
            {!user ? (
              <p className="text-sm text-[#a56b45]">登录之后才能上传图片和音效。</p>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
}
