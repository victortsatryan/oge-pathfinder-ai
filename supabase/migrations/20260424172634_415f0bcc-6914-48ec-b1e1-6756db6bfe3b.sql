create extension if not exists pgcrypto;

create type public.diagnostic_type as enum ('entry', 'weekly');
create type public.resource_type as enum ('theory', 'video', 'practice');
create type public.lesson_status as enum ('locked', 'available', 'completed', 'missed');
create type public.difficulty_level as enum ('easy', 'medium', 'hard', 'adaptive');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  exam_code text,
  color_token text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  theme_code text,
  exam_section text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subject_id, title)
);

create table public.content_resources (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  resource_type public.resource_type not null,
  title text not null,
  content_markdown text,
  video_url text,
  source_url text,
  tasks jsonb not null default '[]'::jsonb,
  solution_text text,
  difficulty public.difficulty_level not null default 'medium',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'План подготовки к ОГЭ',
  period_start date not null,
  period_end date not null,
  weekly_rest_day smallint not null default 7,
  sessions_per_day smallint not null default 4,
  generated_by_ai boolean not null default true,
  plan_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid references public.topics(id) on delete set null,
  lesson_date date not null,
  slot_number smallint not null check (slot_number between 1 and 4),
  title text not null,
  theory_markdown text,
  video_url text,
  tasks jsonb not null default '[]'::jsonb,
  difficulty public.difficulty_level not null default 'adaptive',
  status public.lesson_status not null default 'locked',
  teacher_note text,
  ai_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_date, slot_number)
);

create table public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  diagnostic_type public.diagnostic_type not null,
  scheduled_for date,
  completed_at timestamptz,
  score numeric(5,2),
  max_score numeric(5,2),
  weaknesses jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  diagnostic_session_id uuid references public.diagnostic_sessions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid references public.topics(id) on delete set null,
  task_key text not null,
  prompt_snapshot text,
  student_answer jsonb,
  correct_answer jsonb,
  is_correct boolean,
  score numeric(5,2),
  feedback text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  source_kind text not null,
  source_id uuid,
  summary text not null,
  focus_topics jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_topics_subject_id on public.topics(subject_id);
create index idx_content_resources_subject_id on public.content_resources(subject_id);
create index idx_content_resources_topic_id on public.content_resources(topic_id);
create index idx_study_plans_user_id on public.study_plans(user_id);
create index idx_lessons_user_id_date on public.lessons(user_id, lesson_date);
create index idx_lessons_subject_id on public.lessons(subject_id);
create index idx_diagnostic_sessions_user_subject on public.diagnostic_sessions(user_id, subject_id);
create index idx_task_attempts_user_id on public.task_attempts(user_id);
create index idx_task_attempts_lesson_id on public.task_attempts(lesson_id);
create index idx_ai_recommendations_user_id on public.ai_recommendations(user_id);

alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.content_resources enable row level security;
alter table public.study_plans enable row level security;
alter table public.lessons enable row level security;
alter table public.diagnostic_sessions enable row level security;
alter table public.task_attempts enable row level security;
alter table public.ai_recommendations enable row level security;

create policy "Subjects are readable by authenticated users"
on public.subjects
for select
to authenticated
using (true);

create policy "Topics are readable by authenticated users"
on public.topics
for select
to authenticated
using (true);

create policy "Content resources are readable by authenticated users"
on public.content_resources
for select
to authenticated
using (is_published = true);

create policy "Users can view their own study plans"
on public.study_plans
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own study plans"
on public.study_plans
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own study plans"
on public.study_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own study plans"
on public.study_plans
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own lessons"
on public.lessons
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own lessons"
on public.lessons
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own lessons"
on public.lessons
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own lessons"
on public.lessons
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own diagnostics"
on public.diagnostic_sessions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own diagnostics"
on public.diagnostic_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own diagnostics"
on public.diagnostic_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own diagnostics"
on public.diagnostic_sessions
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own task attempts"
on public.task_attempts
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own task attempts"
on public.task_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own task attempts"
on public.task_attempts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own task attempts"
on public.task_attempts
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own AI recommendations"
on public.ai_recommendations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own AI recommendations"
on public.ai_recommendations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own AI recommendations"
on public.ai_recommendations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own AI recommendations"
on public.ai_recommendations
for delete
to authenticated
using (auth.uid() = user_id);

create trigger update_subjects_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger update_topics_updated_at
before update on public.topics
for each row execute function public.set_updated_at();

create trigger update_content_resources_updated_at
before update on public.content_resources
for each row execute function public.set_updated_at();

create trigger update_study_plans_updated_at
before update on public.study_plans
for each row execute function public.set_updated_at();

create trigger update_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger update_diagnostic_sessions_updated_at
before update on public.diagnostic_sessions
for each row execute function public.set_updated_at();

create trigger update_task_attempts_updated_at
before update on public.task_attempts
for each row execute function public.set_updated_at();

create trigger update_ai_recommendations_updated_at
before update on public.ai_recommendations
for each row execute function public.set_updated_at();