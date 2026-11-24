import { randomUUID } from "crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { hashPassword } from "@/lib/passwords";

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
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `alter table users add column if not exists is_admin boolean not null default false`,
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
    object_key text not null,
    primary key (user_id, stage)
  )`,
  `create table if not exists player_audio (
    user_id uuid primary key references users(id) on delete cascade,
    content_type text not null,
    object_key text not null,
    updated_at timestamptz not null default now()
  )`,
  `alter table player_images add column if not exists object_key text`,
  `alter table player_audio add column if not exists object_key text`,
  `delete from player_images where object_key is null`,
  `delete from player_audio where object_key is null`,
  `alter table player_images alter column object_key set not null`,
  `alter table player_audio alter column object_key set not null`,
  `alter table player_images drop column if exists data_base64`,
  `alter table player_audio drop column if exists data_base64`,
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
      const passwordHash = await hashPassword("admin");
      await sql`
        insert into users (id, username, password_hash, is_admin)
        values (${randomUUID()}, 'admin', ${passwordHash}, true)
        on conflict (username) do update
        set password_hash = excluded.password_hash,
            is_admin = true
      `;
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
