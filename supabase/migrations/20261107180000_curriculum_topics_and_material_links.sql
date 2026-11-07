-- Curriculum topics are not limited to exam tasks. Teachers can ADD their own public topic
-- but cannot edit or delete pre-existing admin/teacher topics.
create policy "topics teacher insert own"
on public.topics for insert to authenticated
with check (
  (select auth.uid()) = created_by
  and public.has_role((select auth.uid()), 'teacher'::public.app_role)
  and is_public = true
);

-- A text can legitimately teach multiple topics (and a topic can use many books).
-- Keep existing materials.topic_id as the legacy primary link; new links are additive.
create table if not exists public.material_topic_links (
  material_id uuid not null references public.materials(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  link_type text not null default 'explains' check (link_type in ('explains','practices','related')),
  link_source text not null default 'explicit_admin' check (link_source in ('explicit_admin','exact_heading')),
  linked_by uuid,
  linked_at timestamptz not null default now(),
  primary key (material_id, topic_id)
);
create index if not exists idx_material_topic_links_topic on public.material_topic_links(topic_id);
alter table public.material_topic_links enable row level security;
grant select,insert,delete on public.material_topic_links to authenticated;
revoke all on public.material_topic_links from anon;

create policy "material_topic_links read authenticated"
on public.material_topic_links for select to authenticated
using (
  exists (
    select 1 from public.materials m
    where m.id = material_id and m.status = 'published' and m.is_public = true
  )
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);
create policy "material_topic_links insert admin verified subjects"
on public.material_topic_links for insert to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  and linked_by = (select auth.uid())
  and exists (
    select 1 from public.materials m
    join public.topics t on t.id = topic_id and t.subject_id = m.subject_id
    where m.id = material_id and m.status = 'published' and m.is_public = true
  )
);
create policy "material_topic_links delete admin"
on public.material_topic_links for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));
