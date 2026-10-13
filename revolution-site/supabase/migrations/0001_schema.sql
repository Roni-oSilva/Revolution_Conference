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
