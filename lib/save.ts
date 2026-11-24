import { FRUITS, WORLD } from "@/lib/fruits";

export type FruitSnapshot = {
  kind: number;
  x: number;
  y: number;
};

export type SaveState = {
  score: number;
  best: number;
  next: number;
  over: boolean;
  fruits: FruitSnapshot[];
  updatedAt: string;
};

const KEY = "suika-save-v1";

export function emptySave(): SaveState {
  return {
    score: 0,
    best: 0,
    next: 0,
    over: false,
    fruits: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function readLocalSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return parseSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalSave(save: SaveState) {
  window.localStorage.setItem(KEY, JSON.stringify(save));
}

export function parseSave(input: unknown): SaveState | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<SaveState>;
  if (!Array.isArray(value.fruits) || value.fruits.length > 80) return null;
  const fruits: FruitSnapshot[] = [];
  for (const item of value.fruits) {
    if (!item || typeof item !== "object") return null;
    const fruit = item as Partial<FruitSnapshot>;
    const kind = Number(fruit.kind);
    const x = Number(fruit.x);
    const y = Number(fruit.y);
    if (!Number.isInteger(kind) || kind < 0 || kind >= FRUITS.length) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || x > WORLD.width || y < 0 || y > WORLD.height + 40) return null;
    fruits.push({ kind, x, y });
  }
  const score = Number(value.score);
  const best = Number(value.best);
  const next = Number(value.next);
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000) return null;
  if (!Number.isFinite(best) || best < 0 || best > 1_000_000) return null;
  if (!Number.isInteger(next) || next < 0 || next > 4) return null;
  return {
    score,
    best: Math.max(best, score),
    next,
    over: Boolean(value.over),
    fruits,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}
