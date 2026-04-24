create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  screen_style text not null default 'clean-minimal',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_screen_style_check check (screen_style in ('editorial-light', 'dark-academic', 'clean-minimal'))
);

create index if not exists idx_user_preferences_user_id on public.user_preferences(user_id);

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own preferences"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
on public.user_preferences
for delete
to authenticated
using (auth.uid() = user_id);

create trigger update_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();