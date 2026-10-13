-- Programação dos dias (cadastrada só pelo painel; visitantes apenas leem o que está publicado).
create table if not exists public.schedule_items (
  id           uuid primary key default gen_random_uuid(),
  day_label    text not null check (char_length(day_label) between 1 and 60),      -- ex.: "Dia 1 · 17 de outubro"
  time_label   text not null default '' check (char_length(time_label) <= 20),     -- ex.: "19h30"
  title        text not null check (char_length(title) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 600),
  position     int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists schedule_public_idx on public.schedule_items (is_published, position);

drop trigger if exists schedule_items_touch on public.schedule_items;
create trigger schedule_items_touch before update on public.schedule_items for each row execute function public.touch_updated_at();

alter table public.schedule_items enable row level security;
grant select on public.schedule_items to anon, authenticated;
grant insert, update, delete on public.schedule_items to authenticated;
drop policy if exists schedule_read on public.schedule_items;
create policy schedule_read on public.schedule_items for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists schedule_write on public.schedule_items;
create policy schedule_write on public.schedule_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
