import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export class NoDatabaseError extends Error {
  constructor() {
    super("数据库还没配置");
    this.name = "NoDatabaseError";
  }
}

type Sql = NeonQueryFunction<false, false>;

let schema: Promise<void> | null = null;
let cached: Sql | null = null;

const STATEMENTS = [
  `create table if not exists users (
    id uuid primary key,
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sessions (
    token_hash text primary key,
    user_id uuid not null references users(id) on delete cascade,
    expires_at timestamptz not null
  )`,
  `create table if not exists player_saves (
    user_id uuid primary key references users(id) on delete cascade,
    best_score integer not null default 0,
    state jsonb not null,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists player_images (
    user_id uuid not null references users(id) on delete cascade,
    stage integer not null check (stage >= 0 and stage <= 10),
    content_type text not null,
    data_base64 text not null,
    primary key (user_id, stage)
  )`,
  `create table if not exists player_audio (
    user_id uuid primary key references users(id) on delete cascade,
    content_type text not null,
    data_base64 text not null,
    updated_at timestamptz not null default now()
  )`,
];

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NoDatabaseError();
  if (!cached) cached = neon(url);
  if (!schema) {
    const sql = cached;
    schema = (async () => {
      for (const statement of STATEMENTS) {
        await sql.query(statement);
      }
    })().catch((error) => {
      schema = null;
      throw error;
    });
  }
  await schema;
  return cached;
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
