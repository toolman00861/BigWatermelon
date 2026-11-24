-- 在 Neon 的 SQL 编辑器里执行一次。应用启动时也会用同一套语句自动建表。

create table if not exists users (
  id uuid primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists player_saves (
  user_id uuid primary key references users(id) on delete cascade,
  best_score integer not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists player_images (
  user_id uuid not null references users(id) on delete cascade,
  stage integer not null check (stage >= 0 and stage <= 10),
  content_type text not null,
  data_base64 text not null,
  primary key (user_id, stage)
);

create table if not exists player_audio (
  user_id uuid primary key references users(id) on delete cascade,
  content_type text not null,
  data_base64 text not null,
  updated_at timestamptz not null default now()
);
