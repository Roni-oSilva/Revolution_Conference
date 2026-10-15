-- ═══════════════════════════════════════════════════════════════
-- REVOLUTION CONFERENCE — TUDO DE UMA VEZ
-- Cole este arquivo INTEIRO no Supabase → SQL Editor → New query → Run.
-- (Cria as tabelas, as regras de segurança e coloca os dados reais do evento.)
-- Rode UMA vez só: a programação é apagada e recriada no final.
-- ═══════════════════════════════════════════════════════════════

-- ───────── 0001_schema.sql ─────────
-- Revolution Conference — esquema base.
-- Rode as migrações em ordem (0001 → 0004) no SQL Editor do Supabase ou com `supabase db push`.
-- Todas são idempotentes quando possível.

-- ───────────────────────── Administradores ─────────────────────────
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);
comment on table public.admin_users is 'Quem pode administrar. role=owner gerencia admins e limites de segurança; editor gerencia conteúdo.';

-- ───────────────────────── Configurações ─────────────────────────
create table if not exists public.site_settings (
  id                smallint primary key default 1 check (id = 1),
  site_title        text not null default 'Revolution Conference' check (char_length(site_title) between 1 and 120),
  tagline           text not null default '' check (char_length(tagline) <= 200),
  seo_description   text not null default '' check (char_length(seo_description) <= 300),
  hero_image_url    text check (hero_image_url is null or hero_image_url ~ '^https://[^[:space:]]+$'),
  instagram_url     text check (instagram_url is null or instagram_url ~ '^https://[^[:space:]]+$'),
  youtube_channel_url text check (youtube_channel_url is null or youtube_channel_url ~ '^https://[^[:space:]]+$'),
  whatsapp_url      text check (whatsapp_url is null or whatsapp_url ~ '^https://[^[:space:]]+$'),
  privacy_text      text check (privacy_text is null or char_length(privacy_text) <= 20000),
  -- segurança (somente role=owner altera; ver trigger em 0003)
  reactions_enabled          boolean not null default true,
  reaction_limit_per_minute  int not null default 20  check (reaction_limit_per_minute between 1 and 300),
  reaction_limit_per_ip_minute int not null default 120 check (reaction_limit_per_ip_minute between 1 and 3000),
  updated_at        timestamptz not null default now()
);

create table if not exists public.event_settings (
  id             smallint primary key default 1 check (id = 1),
  name           text not null default 'Revolution Conference' check (char_length(name) between 1 and 120),
  description    text not null default '' check (char_length(description) <= 2000),
  timezone       text not null default 'America/Sao_Paulo',
  starts_at      timestamptz,   -- data/hora do evento (exibição)
  opens_at       timestamptz,   -- fim da contagem regressiva e troca automática para a fase "pós-abertura"
  ends_at        timestamptz,   -- opcional
  location_name  text check (location_name is null or char_length(location_name) <= 160),
  address        text check (address is null or char_length(address) <= 300),
  maps_url       text check (maps_url is null or maps_url ~ '^https://[^[:space:]]+$'),
  stream_enabled boolean not null default false,
  stream_url     text check (stream_url is null or stream_url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/[^[:space:]]*$'),
  stream_video_id text check (stream_video_id is null or stream_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  stream_note    text not null default '' check (char_length(stream_note) <= 500),
  updated_at     timestamptz not null default now(),
  check (opens_at is null or ends_at is null or ends_at > opens_at)
);

-- ───────────────────────── Mídia (fotos do Google Drive) ─────────────────────────
create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  original_url  text not null check (original_url ~ '^https://(drive|docs)\.google\.com/[^[:space:]]+$'),
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,120}$'),
  title         text not null default '' check (char_length(title) <= 120),
  alt           text not null default '' check (char_length(alt) <= 200),
  caption       text not null default '' check (char_length(caption) <= 300),
  position      int  not null default 0,
  is_featured   boolean not null default false,
  is_published  boolean not null default false,
  availability  text not null default 'unknown' check (availability in ('unknown', 'ok', 'unavailable')),
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists media_drive_file_id_key on public.media (drive_file_id);
create index if not exists media_public_idx on public.media (is_published, position);

-- ───────────────────────── Vídeos (YouTube) ─────────────────────────
create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 1000),
  category     text not null default 'Geral' check (char_length(category) between 1 and 60),
  youtube_id   text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  url          text not null check (url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/[^[:space:]]*$'),
  position     int  not null default 0,
  is_published boolean not null default true,
  availability text not null default 'unknown' check (availability in ('unknown', 'ok', 'unavailable')),
  checked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists videos_youtube_id_key on public.videos (youtube_id);
create index if not exists videos_public_idx on public.videos (is_published, category, position);

-- ───────────────────────── Mural ─────────────────────────
create table if not exists public.wall_posts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default '' check (char_length(title) <= 120),
  body           text not null check (char_length(btrim(body)) between 1 and 2000),
  image_media_id uuid references public.media(id) on delete set null,
  position       int  not null default 0,
  status         text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  is_highlight   boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists wall_posts_feed_idx on public.wall_posts (status, position, published_at desc);
create index if not exists wall_posts_image_idx on public.wall_posts (image_media_id);

-- Contagens de reações: mantidas SOMENTE por trigger (ninguém edita direto).
create table if not exists public.post_reaction_counts (
  post_id uuid not null references public.wall_posts(id) on delete cascade,
  emoji   text not null check (emoji in ('❤️', '🙌', '🔥', '👏', '😍')),
  count   int  not null default 0 check (count >= 0),
  primary key (post_id, emoji)
);

-- Uma reação por (publicação, ID anônimo). O ID é aleatório e persistente no navegador — NÃO identifica pessoas.
create table if not exists public.post_reactions (
  post_id    uuid not null references public.wall_posts(id) on delete cascade,
  anon_id    uuid not null,
  emoji      text not null check (emoji in ('❤️', '🙌', '🔥', '👏', '😍')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, anon_id)
);
create index if not exists post_reactions_anon_idx on public.post_reactions (anon_id);

-- Limite de frequência (janelas de 1 minuto). A chave é um hash — nunca IP ou dado pessoal em claro.
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- Linhas únicas de configuração
insert into public.site_settings (id) values (1) on conflict do nothing;
-- datas do evento: definidas pelo administrador no painel (nenhuma data é presumida)
insert into public.event_settings (id) values (1) on conflict do nothing;

-- ───────── 0002_functions_triggers.sql ─────────
-- Funções de autorização, triggers e a função de reação.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.role = 'owner');
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['site_settings','event_settings','media','videos','wall_posts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- Fuso horário precisa existir
create or replace function public.validate_event_timezone() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists event_settings_tz on public.event_settings;
create trigger event_settings_tz before insert or update on public.event_settings for each row execute function public.validate_event_timezone();

-- Campos de segurança: via API (JWT anon/authenticated) só o owner altera.
-- SQL Editor / service_role (sem JWT de usuário) continuam livres para manutenção.
create or replace function public.guard_security_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.reactions_enabled is distinct from old.reactions_enabled
      or new.reaction_limit_per_minute is distinct from old.reaction_limit_per_minute
      or new.reaction_limit_per_ip_minute is distinct from old.reaction_limit_per_ip_minute)
     and coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_owner() then
    raise exception 'Somente o owner pode alterar os limites de segurança.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists site_settings_guard on public.site_settings;
create trigger site_settings_guard before update on public.site_settings for each row execute function public.guard_security_fields();

-- Nunca ficar sem owner
create or replace function public.protect_last_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare owners int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into owners from public.admin_users where role = 'owner' and user_id <> old.user_id;
    if owners = 0 then raise exception 'Não é possível remover ou rebaixar o último owner.' using errcode = '23514'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists admin_users_last_owner on public.admin_users;
create trigger admin_users_last_owner before update or delete on public.admin_users for each row execute function public.protect_last_owner();

-- published_at automático ao publicar
create or replace function public.wall_post_publish_stamp() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  return new;
end $$;
drop trigger if exists wall_posts_stamp on public.wall_posts;
create trigger wall_posts_stamp before insert or update on public.wall_posts for each row execute function public.wall_post_publish_stamp();

-- Contagens a partir de post_reactions (única forma de alterar post_reaction_counts)
create or replace function public.apply_reaction_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.post_reaction_counts set count = greatest(count - 1, 0) where post_id = old.post_id and emoji = old.emoji;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.post_reaction_counts (post_id, emoji, count) values (new.post_id, new.emoji, 1)
    on conflict (post_id, emoji) do update set count = public.post_reaction_counts.count + 1;
  end if;
  return null;
end $$;
drop trigger if exists post_reactions_counts on public.post_reactions;
create trigger post_reactions_counts after insert or update of emoji or delete on public.post_reactions
  for each row execute function public.apply_reaction_counts();

-- ───────────────────────── Reagir (somente service_role: chamada pelo servidor Next.js) ─────────────────────────
-- p_emoji = NULL remove a reação. Mesma reação repetida é idempotente. Troca de emoji atualiza a linha.
create or replace function public.react_to_post(p_post_id uuid, p_anon_id uuid, p_emoji text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; win timestamptz := date_trunc('minute', now());
  k_anon text := 'react:anon:' || p_anon_id::text; k_ip text := 'react:ip:' || coalesce(p_ip_hash, 'unknown');
  n_anon int; n_ip int; cur text; res text;
begin
  select reactions_enabled, reaction_limit_per_minute, reaction_limit_per_ip_minute into s from public.site_settings where id = 1;
  if not s.reactions_enabled then return jsonb_build_object('error', 'disabled'); end if;
  if p_emoji is not null and p_emoji not in ('❤️', '🙌', '🔥', '👏', '😍') then return jsonb_build_object('error', 'invalid_emoji'); end if;
  if not exists (select 1 from public.wall_posts where id = p_post_id and status = 'published') then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.rate_limits (key, window_start, hits) values (k_anon, win, 1)
    on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1 returning hits into n_anon;
  insert into public.rate_limits (key, window_start, hits) values (k_ip, win, 1)
    on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1 returning hits into n_ip;
  delete from public.rate_limits where window_start < now() - interval '10 minutes';
  if n_anon > s.reaction_limit_per_minute or n_ip > s.reaction_limit_per_ip_minute then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  select emoji into cur from public.post_reactions where post_id = p_post_id and anon_id = p_anon_id;
  if p_emoji is null then
    if cur is null then res := 'noop'; else delete from public.post_reactions where post_id = p_post_id and anon_id = p_anon_id; res := 'removed'; end if;
  elsif cur is null then
    insert into public.post_reactions (post_id, anon_id, emoji) values (p_post_id, p_anon_id, p_emoji); res := 'added';
  elsif cur = p_emoji then res := 'noop';
  else
    update public.post_reactions set emoji = p_emoji, updated_at = now() where post_id = p_post_id and anon_id = p_anon_id; res := 'changed';
  end if;
  return jsonb_build_object('ok', true, 'action', res, 'emoji', p_emoji);
end $$;
revoke all on function public.react_to_post(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.react_to_post(uuid, uuid, text, text) to service_role;

-- Reações do próprio ID anônimo (somente service_role)
create or replace function public.my_reactions(p_anon_id uuid, p_post_ids uuid[])
returns table (post_id uuid, emoji text) language sql stable security definer set search_path = public as $$
  select r.post_id, r.emoji from public.post_reactions r where r.anon_id = p_anon_id and r.post_id = any (p_post_ids);
$$;
revoke all on function public.my_reactions(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.my_reactions(uuid, uuid[]) to service_role;

-- ───────── 0003_rls.sql ─────────
-- Row Level Security + privilégios mínimos.

alter table public.admin_users          enable row level security;
alter table public.site_settings        enable row level security;
alter table public.event_settings       enable row level security;
alter table public.media                enable row level security;
alter table public.videos               enable row level security;
alter table public.wall_posts           enable row level security;
alter table public.post_reaction_counts enable row level security;
alter table public.post_reactions       enable row level security;
alter table public.rate_limits          enable row level security;

-- Privilégios: começa do zero e concede o mínimo (RLS ainda filtra linhas).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.site_settings, public.event_settings, public.media, public.videos, public.wall_posts, public.post_reaction_counts to anon, authenticated;
grant select on public.admin_users, public.post_reactions to authenticated;
grant insert, update, delete on public.media, public.videos, public.wall_posts to authenticated;
grant update on public.site_settings, public.event_settings to authenticated;
grant insert, update, delete on public.admin_users to authenticated;
-- service_role (somente no servidor) precisa ler/gravar o necessário para a rota de reações e manutenção
grant all on all tables in schema public to service_role;

-- admin_users
drop policy if exists admin_users_read on public.admin_users;
create policy admin_users_read on public.admin_users for select to authenticated using (user_id = auth.uid() or public.is_owner());
drop policy if exists admin_users_write on public.admin_users;
create policy admin_users_write on public.admin_users for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- configurações: leitura pública; escrita por admin (campos de segurança: trigger exige owner)
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists event_settings_read on public.event_settings;
create policy event_settings_read on public.event_settings for select to anon, authenticated using (true);
drop policy if exists event_settings_write on public.event_settings;
create policy event_settings_write on public.event_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- conteúdo: público vê só o publicado; admin vê/escreve tudo
drop policy if exists media_read on public.media;
create policy media_read on public.media for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists media_write on public.media;
create policy media_write on public.media for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists videos_read on public.videos;
create policy videos_read on public.videos for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists videos_write on public.videos;
create policy videos_write on public.videos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists wall_posts_read on public.wall_posts;
create policy wall_posts_read on public.wall_posts for select to anon, authenticated
  using ((status = 'published' and (published_at is null or published_at <= now())) or public.is_admin());
drop policy if exists wall_posts_write on public.wall_posts;
create policy wall_posts_write on public.wall_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- contagens: leitura pública; NENHUMA policy de escrita (só o trigger security definer altera)
drop policy if exists counts_read on public.post_reaction_counts;
create policy counts_read on public.post_reaction_counts for select to anon, authenticated using (true);

-- reações brutas: só admin lê (dashboard); ninguém escreve direto
drop policy if exists reactions_admin_read on public.post_reactions;
create policy reactions_admin_read on public.post_reactions for select to authenticated using (public.is_admin());

-- rate_limits: sem policies => inacessível para anon/authenticated

-- ───────── 0004_realtime.sql ─────────
-- Realtime somente no necessário: novas publicações e contagens de reações.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.post_reaction_counts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.wall_posts; exception when duplicate_object then null; end;
  end if;
end $$;

-- ───────── 0005_media_album.sql ─────────
-- Álbum da foto (ex.: "Dia 1", "Dia 2"): usado nas pastas da home e no filtro da galeria.
alter table public.media add column if not exists album text not null default '' check (char_length(album) <= 60);
create index if not exists media_album_idx on public.media (album) where is_published;

-- ───────── 0006_schedule.sql ─────────
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

-- ───────── seed_evento.sql ─────────
-- Dados reais do evento. Rode UMA vez no SQL Editor do Supabase DEPOIS das migrações
-- (ou edite tudo em /admin/evento). Fuso: America/Sao_Paulo.
update public.event_settings set
  location_name = 'Evangelho Pleno Ulianópolis',
  address       = 'R. Dom Teresa Cristina, 135 · Centro, Ulianópolis — PA',
  maps_url      = 'https://maps.app.goo.gl/hMozkG8gsnRN1rEt5',
  timezone      = 'America/Sao_Paulo',
  starts_at     = '2026-10-17T18:00:00-03:00',   -- abertura (o credenciamento é às 16h)
  opens_at      = '2026-10-17T18:00:00-03:00',   -- momento da troca de fase "pré → evento"
  ends_at       = '2026-10-18T12:00:00-03:00'
where id = 1;

update public.site_settings set
  instagram_url       = 'https://www.instagram.com/revolucaojovemiep/',
  youtube_channel_url = 'https://www.youtube.com/@evangelhoplenoulianopolis'
where id = 1;

-- ───────── seed_programacao.sql ─────────
-- Programação oficial (17 e 18/10/2026): só horário e momento.
-- Rode UMA vez no SQL Editor do Supabase DEPOIS das migrações. Também dá para editar tudo em /admin/programacao.
delete from public.schedule_items;
insert into public.schedule_items (day_label, time_label, title, position, is_published) values
  ('Sábado, 17/10/2026', '16h00', 'Credenciamento', 0, true),
  ('Sábado, 17/10/2026', '18h00', 'Abertura — louvor', 1, true),
  ('Sábado, 17/10/2026', '18h45', '1ª sessão — ministração', 2, true),
  ('Sábado, 17/10/2026', '20h00', '2ª sessão — ministério de dança', 3, true),
  ('Sábado, 17/10/2026', '20h10', 'Louvor', 4, true),
  ('Sábado, 17/10/2026', '20h30', 'Ministração', 5, true),
  ('Sábado, 17/10/2026', '21h20', 'Encerramento', 6, true),
  ('Domingo, 18/10/2026', '07h30', 'Café da manhã pronto', 7, true),
  ('Domingo, 18/10/2026', '08h30', 'Chegada', 8, true),
  ('Domingo, 18/10/2026', '09h00', 'Louvor', 9, true),
  ('Domingo, 18/10/2026', '09h30', '1ª sessão — ministração', 10, true),
  ('Domingo, 18/10/2026', '10h10', '2ª sessão — louvor', 11, true),
  ('Domingo, 18/10/2026', '10h25', 'Ministração', 12, true);
