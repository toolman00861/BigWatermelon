"use client";

import { useState } from "react";

export default function Home() {
  const [ready, setReady] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 px-8 py-16 text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
          Next.js
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          合成大西瓜
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          开发环境已预设。游戏本身稍后在这个项目里做。
        </p>
        <button
          type="button"
          className="h-12 rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          onClick={() => setReady(true)}
        >
          检查环境
        </button>
        {ready ? (
          <p className="text-base font-medium text-emerald-700 dark:text-emerald-400">
            环境已就绪
          </p>
        ) : null}
      </main>
    </div>
  );
}
