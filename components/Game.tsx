"use client";

import { useEffect, useRef, useState } from "react";
import type { Body, Engine } from "matter-js";
import { MergeAudio } from "@/lib/audio";
import { drawFruit, FRUITS, randomDropKind, WORLD } from "@/lib/fruits";
import { readLocalSave, type SaveState, writeLocalSave } from "@/lib/save";
import { SettingsSheet, type AccountUser } from "@/components/SettingsSheet";

type Meta = {
  kind: number;
  born: number;
  danger: number;
  popUntil: number;
};

type Floater = { x: number; y: number; text: string; life: number };

type EngineApi = {
  snapshot: () => SaveState;
  restore: (save: SaveState) => void;
  reset: () => void;
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<EngineApi | null>(null);
  const audioRef = useRef<MergeAudio>(new MergeAudio());
  const imagesRef = useRef<(HTMLImageElement | null)[]>(FRUITS.map(() => null));
  const userRef = useRef<AccountUser | null>(null);
  const onChangeRef = useRef<(save: SaveState) => void>(() => undefined);
  const pendingSave = useRef<SaveState | null>(null);

  const [hud, setHud] = useState({ score: 0, best: 0, next: 0, over: false, fruits: 0 });
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [database, setDatabase] = useState<boolean | null>(null);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>(FRUITS.map(() => null));
  const [hasAudio, setHasAudio] = useState(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let timer = 0;
    onChangeRef.current = (save) => {
      writeLocalSave(save);
      if (!userRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void fetch("/api/save", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(save),
        });
      }, 700);
    };
    const flush = () => {
      const save = apiRef.current?.snapshot();
      if (!save || !userRef.current) return;
      void fetch("/api/save", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(save),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = (await fetch("/api/auth/me").then((response) => response.json())) as {
        user: AccountUser | null;
        database: boolean;
      };
      if (cancelled) return;
      setDatabase(me.database);
      setUser(me.user);
      if (!me.user) return;
      const [saveResponse, customResponse] = await Promise.all([
        fetch("/api/save"),
        fetch("/api/custom"),
      ]);
      if (cancelled) return;
      if (saveResponse.ok) {
        const body = (await saveResponse.json()) as { state: SaveState | null };
        if (body.state) pendingSave.current = body.state;
      }
      if (customResponse.ok) {
        const custom = (await customResponse.json()) as { images: number[]; audio: boolean };
        setImageUrls(FRUITS.map((_, stage) => (
          custom.images.includes(stage) ? `/api/custom/image/${stage}` : null
        )));
        setHasAudio(custom.audio);
        if (custom.audio) {
          const audio = await fetch("/api/custom/audio");
          if (audio.ok) await audioRef.current.useCustom(await audio.arrayBuffer());
        }
      }
      const waiting = pendingSave.current;
      if (waiting && apiRef.current) {
        const local = readLocalSave();
        if (!local || Date.parse(waiting.updatedAt) >= Date.parse(local.updatedAt)) {
          apiRef.current.restore(waiting);
        }
        pendingSave.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    imageUrls.forEach((url, stage) => {
      if (!url) {
        imagesRef.current[stage] = null;
        return;
      }
      const image = new Image();
      image.src = url;
      imagesRef.current[stage] = image;
    });
  }, [imageUrls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let stopped = false;
    let frame = 0;

    const boot = async () => {
      const imported = (await import("matter-js")) as typeof import("matter-js") & {
        default?: typeof import("matter-js");
      };
      const Matter = imported.Engine ? imported : imported.default;
      if (!Matter || stopped) return;

      const engine: Engine = Matter.Engine.create({ gravity: { x: 0, y: 1.35 } });
      const meta = new Map<number, Meta>();
      const pending = new Set<number>();
      const merges: [Body, Body][] = [];
      const floaters: Floater[] = [];
      let score = 0;
      let best = 0;
      let next = randomDropKind();
      let over = false;
      let aimX = WORLD.width / 2;
      let lastDrop = 0;
      let lastPublish = "";

      const wall = {
        isStatic: true,
        friction: 0.9,
        restitution: 0.05,
        label: "wall",
      };
      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(WORLD.width / 2, WORLD.height - WORLD.wall / 2, WORLD.width, WORLD.wall, wall),
        Matter.Bodies.rectangle(WORLD.wall / 2, WORLD.height / 2, WORLD.wall, WORLD.height, wall),
        Matter.Bodies.rectangle(WORLD.width - WORLD.wall / 2, WORLD.height / 2, WORLD.wall, WORLD.height, wall),
      ]);

      const fruitBodies = () =>
        Matter.Composite.allBodies(engine.world).filter((body) => meta.has(body.id));

      const publish = () => {
        const signature = `${score}:${best}:${next}:${over}:${meta.size}`;
        if (signature === lastPublish) return;
        lastPublish = signature;
        setHud({ score, best, next, over, fruits: meta.size });
      };

      const snapshot = (): SaveState => ({
        score,
        best,
        next,
        over,
        fruits: fruitBodies().map((body) => ({
          kind: meta.get(body.id)!.kind,
          x: body.position.x,
          y: body.position.y,
        })),
        updatedAt: new Date().toISOString(),
      });

      const clearFruits = () => {
        for (const body of fruitBodies()) {
          meta.delete(body.id);
          Matter.Composite.remove(engine.world, body);
        }
        merges.length = 0;
        pending.clear();
        floaters.length = 0;
      };

      const addFruit = (kind: number, x: number, y: number, popped: boolean) => {
        const radius = FRUITS[kind].radius;
        const clampedX = Math.min(
          WORLD.width - WORLD.wall - radius,
          Math.max(WORLD.wall + radius, x),
        );
        const body = Matter.Bodies.circle(clampedX, y, radius, {
          restitution: 0.1,
          friction: 0.28,
          density: 0.0016 + kind * 0.00035,
          label: "fruit",
        });
        meta.set(body.id, {
          kind,
          born: performance.now(),
          danger: 0,
          popUntil: popped ? performance.now() + 180 : 0,
        });
        Matter.Composite.add(engine.world, body);
      };

      const restore = (save: SaveState) => {
        clearFruits();
        score = save.score;
        best = Math.max(save.best, save.score);
        next = save.next;
        over = save.over;
        for (const fruit of save.fruits) addFruit(fruit.kind, fruit.x, fruit.y, false);
        publish();
      };

      const emit = () => onChangeRef.current(snapshot());

      apiRef.current = {
        snapshot,
        restore: (save) => {
          restore(save);
          emit();
        },
        reset: () => {
          clearFruits();
          score = 0;
          next = randomDropKind();
          over = false;
          publish();
          emit();
        },
      };

      const local = readLocalSave();
      if (local) restore(local);
      else publish();
      if (pendingSave.current) {
        const remote = pendingSave.current;
        if (!local || Date.parse(remote.updatedAt) >= Date.parse(local.updatedAt)) {
          restore(remote);
        }
        pendingSave.current = null;
      }

      const drop = () => {
        if (over) return;
        const now = performance.now();
        if (now - lastDrop < 450) return;
        lastDrop = now;
        void audioRef.current.unlock();
        addFruit(next, aimX, WORLD.spawnY, false);
        next = randomDropKind();
        publish();
        emit();
      };

      Matter.Events.on(engine, "collisionStart", (event) => {
        if (over) return;
        for (const pair of event.pairs) {
          const left = meta.get(pair.bodyA.id);
          const right = meta.get(pair.bodyB.id);
          if (!left || !right || left.kind !== right.kind || left.kind >= FRUITS.length - 1) continue;
          if (pending.has(pair.bodyA.id) || pending.has(pair.bodyB.id)) continue;
          pending.add(pair.bodyA.id);
          pending.add(pair.bodyB.id);
          merges.push([pair.bodyA, pair.bodyB]);
        }
      });

      Matter.Events.on(engine, "afterUpdate", () => {
        const now = performance.now();
        while (merges.length > 0) {
          const [first, second] = merges.shift()!;
          const firstMeta = meta.get(first.id);
          const secondMeta = meta.get(second.id);
          pending.delete(first.id);
          pending.delete(second.id);
          if (!firstMeta || !secondMeta || over) continue;
          const kind = firstMeta.kind + 1;
          const x = (first.position.x + second.position.x) / 2;
          const y = (first.position.y + second.position.y) / 2;
          meta.delete(first.id);
          meta.delete(second.id);
          Matter.Composite.remove(engine.world, first);
          Matter.Composite.remove(engine.world, second);
          addFruit(kind, x, y, true);
          score += FRUITS[kind].score;
          best = Math.max(best, score);
          floaters.push({ x, y, text: `+${FRUITS[kind].score}`, life: 1 });
          audioRef.current.play(kind);
          publish();
          emit();
        }

        if (!over) {
          for (const body of fruitBodies()) {
            const info = meta.get(body.id)!;
            const speed = Math.hypot(body.velocity.x, body.velocity.y);
            const above = body.position.y - FRUITS[info.kind].radius < WORLD.lineY;
            if (above && speed < 0.45 && now - info.born > 800) info.danger += 16.667;
            else info.danger = 0;
            if (info.danger > 1500) {
              over = true;
              publish();
              emit();
              break;
            }
          }
        }
      });

      const pointerX = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const radius = FRUITS[next].radius;
        const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
        aimX = Math.min(WORLD.width - WORLD.wall - radius, Math.max(WORLD.wall + radius, x));
      };
      const onPointer = (event: PointerEvent) => {
        pointerX(event);
        if (event.type === "pointerdown") drop();
      };
      canvas.addEventListener("pointermove", onPointer);
      canvas.addEventListener("pointerdown", onPointer);

      const draw = () => {
        if (stopped) return;
        frame = window.requestAnimationFrame(draw);
        const dpr = window.devicePixelRatio || 1;
        const width = Math.floor(WORLD.width * dpr);
        const height = Math.floor(WORLD.height * dpr);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, WORLD.width, WORLD.height);

        const well = context.createLinearGradient(0, 0, 0, WORLD.height);
        well.addColorStop(0, "#f8e7c4");
        well.addColorStop(1, "#e7c18a");
        context.fillStyle = well;
        roundRect(context, 8, 8, WORLD.width - 16, WORLD.height - 16, 28);
        context.fill();

        context.save();
        context.beginPath();
        roundRect(context, WORLD.wall, 18, WORLD.width - WORLD.wall * 2, WORLD.height - WORLD.wall - 18, 18);
        context.clip();
        context.fillStyle = "#fbf3e2";
        context.fillRect(0, 0, WORLD.width, WORLD.height);

        context.setLineDash([8, 8]);
        context.strokeStyle = "rgba(196, 64, 48, 0.7)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(WORLD.wall + 12, WORLD.lineY);
        context.lineTo(WORLD.width - WORLD.wall - 12, WORLD.lineY);
        context.stroke();
        context.setLineDash([]);

        if (!over) {
          context.globalAlpha = 0.35;
          context.strokeStyle = "#c98455";
          context.beginPath();
          context.moveTo(aimX, WORLD.spawnY + FRUITS[next].radius);
          context.lineTo(aimX, WORLD.lineY);
          context.stroke();
          context.globalAlpha = 1;
          drawFruit(
            context,
            next,
            aimX,
            WORLD.spawnY,
            FRUITS[next].radius,
            imagesRef.current[next],
          );
        }

        for (const body of fruitBodies()) {
          const info = meta.get(body.id)!;
          const pop = info.popUntil > performance.now()
            ? 0.72 + 0.28 * (1 - (info.popUntil - performance.now()) / 180)
            : 1;
          drawFruit(
            context,
            info.kind,
            body.position.x,
            body.position.y,
            FRUITS[info.kind].radius,
            imagesRef.current[info.kind],
            pop,
          );
        }

        for (let i = floaters.length - 1; i >= 0; i -= 1) {
          const floater = floaters[i];
          floater.life -= 0.02;
          floater.y -= 0.6;
          if (floater.life <= 0) {
            floaters.splice(i, 1);
            continue;
          }
          if (!floater.text) continue;
          context.globalAlpha = floater.life;
          context.fillStyle = "#c2412d";
          context.font = "700 22px sans-serif";
          context.textAlign = "center";
          context.fillText(floater.text, floater.x, floater.y);
          context.globalAlpha = 1;
        }
        context.restore();

        context.strokeStyle = "#8a542c";
        context.lineWidth = 16;
        roundRect(context, 10, 10, WORLD.width - 20, WORLD.height - 20, 30);
        context.stroke();
        context.strokeStyle = "#e7b98a";
        context.lineWidth = 4;
        roundRect(context, 18, 18, WORLD.width - 36, WORLD.height - 36, 24);
        context.stroke();
      };

      const runner = Matter.Runner.create();
      Matter.Runner.run(runner, engine);
      frame = window.requestAnimationFrame(draw);

      return () => {
        canvas.removeEventListener("pointermove", onPointer);
        canvas.removeEventListener("pointerdown", onPointer);
        Matter.Runner.stop(runner);
        Matter.Engine.clear(engine);
      };
    };

    let cleanup: (() => void) | undefined;
    void boot().then((done) => {
      if (stopped) done?.();
      else cleanup = done;
    });
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, []);

  const nextFruit = FRUITS[hud.next];

  return (
    <div className="relative min-h-dvh overflow-hidden text-[#3b2415]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,#fff6e8,transparent_32%),radial-gradient(circle_at_100%_8%,#ffc7ad,transparent_26%),linear-gradient(180deg,#f6d7ae,#e7b483)]" />
      <div className="pointer-events-none absolute -top-16 -left-10 h-56 w-56 rounded-full bg-[#7dbe73]/35 blur-2xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#ef6b4a]/20 blur-3xl" />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 py-4">
        <header className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.28em] text-[#8a542c]">木盒里的水果</p>
            <h1 className="font-display text-4xl leading-none">合成大西瓜</h1>
          </div>
          <button
            type="button"
            className="grid h-12 w-12 place-items-center rounded-full bg-[#fff8ee] text-xl shadow-[0_8px_24px_rgba(90,45,15,0.16)]"
            onClick={() => setOpen(true)}
            aria-label="打开设置"
          >
            ⚙
          </button>
        </header>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="本局" value={hud.score} />
          <Stat label="最高" value={hud.best} />
          <div className="flex items-center gap-2 rounded-2xl bg-[#fff8ee]/85 px-3 py-2 shadow-[0_8px_24px_rgba(90,45,15,0.08)]">
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
              style={{ background: nextFruit.flesh }}
            >
              {nextFruit.name.slice(0, 1)}
            </span>
            <span>
              <span className="block text-[11px] text-[#a56b45]">下一个</span>
              <span className="font-semibold">{nextFruit.name}</span>
            </span>
          </div>
        </div>
        <div
          className="relative"
          data-score={hud.score}
          data-fruits={hud.fruits}
          data-over={hud.over ? "yes" : "no"}
        >
          <canvas
            ref={canvasRef}
            className="w-full touch-none rounded-[32px] shadow-[0_24px_50px_rgba(90,45,15,0.2)]"
            style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
          />
          {hud.over ? (
            <div className="absolute inset-0 grid place-items-center rounded-[32px] bg-[#3b2415]/45 p-6 text-center text-[#fff8ee]">
              <div className="max-w-xs rounded-[28px] bg-[#fff8ee] px-6 py-6 text-[#3b2415]">
                <p className="text-sm tracking-[0.2em] text-[#a56b45]">本局结束</p>
                <p className="font-display mt-1 text-4xl">盒子满了</p>
                <p className="mt-2 text-lg">得分 {hud.score}</p>
                <button
                  type="button"
                  className="mt-4 rounded-full bg-[#e25b45] px-6 py-3 font-semibold text-white"
                  onClick={() => apiRef.current?.reset()}
                >
                  再来一局
                </button>
              </div>
            </div>
          ) : null}
          {hud.fruits === 0 && !hud.over ? (
            <p className="pointer-events-none absolute bottom-8 left-0 w-full text-center text-sm text-[#8a542c]">
              点按木盒，把水果放进去
            </p>
          ) : null}
        </div>
      </main>
      <SettingsSheet
        open={open}
        database={database}
        user={user}
        imageUrls={imageUrls}
        hasAudio={hasAudio}
        onClose={() => setOpen(false)}
        onUser={(nextUser) => {
          setUser(nextUser);
          if (!nextUser) {
            setImageUrls(FRUITS.map(() => null));
            setHasAudio(false);
            audioRef.current.clearCustom();
          }
        }}
        onImage={(stage, url) => {
          setImageUrls((current) => current.map((item, index) => (index === stage ? url : item)));
        }}
        onAudio={(buffer) => {
          if (!buffer) {
            setHasAudio(false);
            audioRef.current.clearCustom();
            return;
          }
          setHasAudio(true);
          void audioRef.current.useCustom(buffer);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#fff8ee]/85 px-3 py-2 shadow-[0_8px_24px_rgba(90,45,15,0.08)]">
      <span className="block text-[11px] text-[#a56b45]">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
