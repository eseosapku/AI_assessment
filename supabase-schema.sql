-- AI Assessment Platform — full schema
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/pjnrurifxwlmukmdkipy/sql/new

-- ── 1. users ──────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  password_hash       text not null,
  name                text not null,
  student_id          text,
  class               text,
  role                text not null default 'student' check (role in ('student', 'teacher')),
  subjects            text[],
  reset_token         text,
  reset_token_expires timestamptz,
  created_at          timestamptz not null default now()
);

-- ── 2. assessments ────────────────────────────────────────────────────────────
create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,
  subject        text,
  difficulty     text,
  duration       integer,
  questions_data jsonb,
  status         text default 'completed',
  created_at     timestamptz not null default now()
);

-- ── 3. results ────────────────────────────────────────────────────────────────
create table if not exists public.results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  assessment_id   uuid references public.assessments(id) on delete set null,
  score           integer,
  percentage      integer,
  total_questions integer,
  answers         jsonb default '{}',
  feedback        jsonb,
  questions_data  jsonb,
  longform_grades jsonb,
  created_at      timestamptz not null default now()
);

-- ── 4. assignments ────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       text not null,
  teacher_name     text,
  title            text,
  subject          text,
  topics           text[],
  grade            text,
  curriculum       text,
  difficulty_level text,
  question_count   integer,
  style            text,
  question_type    text,
  student_emails   text[],
  deadline         timestamptz,
  created_at       timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_results_user_id       on public.results(user_id);
create index if not exists idx_results_created_at    on public.results(created_at desc);
create index if not exists idx_assessments_user_id   on public.assessments(user_id);
create index if not exists idx_assignments_teacher   on public.assignments(teacher_id);
create index if not exists idx_users_email           on public.users(email);

-- ── RLS — disable (app uses custom JWT, not Supabase Auth) ───────────────────
alter table public.users        disable row level security;
alter table public.assessments  disable row level security;
alter table public.results      disable row level security;
alter table public.assignments  disable row level security;

-- Allow anon key full access (needed since we disabled RLS)
grant all on public.users        to anon, authenticated;
grant all on public.assessments  to anon, authenticated;
grant all on public.results      to anon, authenticated;
grant all on public.assignments  to anon, authenticated;
