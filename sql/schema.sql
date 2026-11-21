create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('kosakata','percakapan','mendengarkan','bacaan')),
  stem_ja text not null,
  stem_id text,
  passage_ja text,
  options jsonb not null,            -- [{"ja":"...","id":"..."} x4]
  answer int not null check (answer between 0 and 3),
  explanation_id text,
  image_url text,
  audio_url text,
  status text not null default 'draft' check (status in ('draft','verified','rejected')),
  hash text unique,
  created_at timestamptz default now()
);
create index if not exists questions_sec_idx on questions(section, status);
alter table questions enable row level security; -- tanpa policy: hanya service key (server) yang bisa akses
