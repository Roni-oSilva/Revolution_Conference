-- Revolution Conference — schema, RLS, triggers.
-- Rode no SQL Editor do Supabase (ou `supabase db push`).

create extension if not exists pgcrypto;

create type user_role as enum ('USER', 'ADMIN');
create type user_status as enum ('active', 'blocked');
create type content_status as enum ('visible', 'hidden', 'deleted');
create type moderation_status as enum ('pending', 'approved', 'rejected');
create type report_status as enum ('open', 'reviewed', 'dismissed');
create type event_status as enum ('draft', 'upcoming', 'live', 'past');

/* ── profiles ─────────────────────────────────────────────── */
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  avatar_url text,
  role user_role not null default 'USER',
  status user_status not null default 'active',
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where user_id = auth.uid() and role = 'ADMIN' and status = 'active');
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where user_id = auth.uid() and status = 'active');
$$;

-- cria o perfil no cadastro (o e-mail fica só em auth.users, nunca em profiles)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, name)
  values (new.id, left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'name', 'Visitante'), '[<>]', '', 'g'), 80));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- usuário comum nunca altera o próprio role/status
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.user_id := old.user_id;
  end if;
  new.name := left(regexp_replace(new.name, '[<>]', '', 'g'), 80);
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

/* ── events / albums ──────────────────────────────────────── */
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  cover_image text,
  drive_folder_id text,
  status event_status not null default 'upcoming',
  created_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  drive_folder_id text unique,
  created_at timestamptz not null default now(),
  unique (event_id, slug)
);

/* ── photos / videos (fonte: Google Drive) ────────────────── */
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  album_id uuid references public.albums (id) on delete set null,
  drive_file_id text not null unique,
  title text not null,
  description text,
  category text,
  drive_url text not null,
  thumbnail_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.photos (event_id, category, created_at desc);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  drive_file_id text not null unique,
  title text not null,
  description text,
  category text,
  drive_url text not null,
  thumbnail_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.videos (event_id, category, created_at desc);

/* ── interação (Supabase, nunca no Drive) ─────────────────── */
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  photo_id uuid references public.photos (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null,
  status content_status not null default 'visible',
  created_at timestamptz not null default now(),
  check (num_nonnulls(photo_id, video_id) = 1)
);
create index on public.comments (photo_id, created_at);
create index on public.comments (video_id, created_at);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  photo_id uuid references public.photos (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(photo_id, video_id) = 1),
  unique (user_id, photo_id),   -- uma curtida por usuário por conteúdo
  unique (user_id, video_id)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  content text not null,
  image_url text,
  status moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);

create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.drive_sync_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  started_by uuid references auth.users (id) on delete set null,
  status text not null default 'running',
  files_found int not null default 0,
  photos_imported int not null default 0,
  videos_imported int not null default 0,
  errors jsonb not null default '[]',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

/* ── sanitização + rate limiting (no banco, não só no front) ─ */
create function public.clean_text(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(t, '[<>]', '', 'g'), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g'));
$$;

create function public.before_comment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.content := clean_text(new.content);
  if char_length(new.content) not between 1 and 1000 then
    raise exception 'Comentário deve ter entre 1 e 1000 caracteres';
  end if;
  if (select count(*) from comments where user_id = new.user_id
        and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Muitos comentários em pouco tempo. Aguarde um instante.';
  end if;
  if exists (select 1 from comments where user_id = new.user_id
        and content = new.content and created_at > now() - interval '5 minutes') then
    raise exception 'Comentário duplicado';
  end if;
  new.status := 'visible';
  return new;
end $$;
create trigger before_comment_insert before insert on public.comments
  for each row execute function public.before_comment_insert();

create function public.before_testimonial_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.content := clean_text(new.content);
  if char_length(new.content) not between 10 and 2000 then
    raise exception 'Testemunho deve ter entre 10 e 2000 caracteres';
  end if;
  if (select count(*) from testimonials where user_id = new.user_id
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Limite de testemunhos por hora atingido';
  end if;
  if not public.is_admin() then new.status := 'pending'; end if;
  return new;
end $$;
create trigger before_testimonial_insert before insert on public.testimonials
  for each row execute function public.before_testimonial_insert();

create function public.before_report_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reason := clean_text(new.reason);
  new.status := 'open';
  if (select count(*) from reports where user_id = new.user_id
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Limite de denúncias por hora atingido';
  end if;
  return new;
end $$;
create trigger before_report_insert before insert on public.reports
  for each row execute function public.before_report_insert();

/* ── Row Level Security ───────────────────────────────────── */
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.testimonials enable row level security;
alter table public.reports enable row level security;
alter table public.admin_logs enable row level security;
alter table public.drive_sync_runs enable row level security;

-- profiles: nome/avatar públicos (não há e-mail aqui); edita só o próprio
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- events/albums/photos/videos: leitura pública, escrita só admin
create policy events_read on public.events for select using (status <> 'draft' or public.is_admin());
create policy events_admin on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy albums_read on public.albums for select using (true);
create policy albums_admin on public.albums for all using (public.is_admin()) with check (public.is_admin());
create policy photos_read on public.photos for select using (true);
create policy photos_admin on public.photos for all using (public.is_admin()) with check (public.is_admin());
create policy videos_read on public.videos for select using (true);
create policy videos_admin on public.videos for all using (public.is_admin()) with check (public.is_admin());

-- comments
create policy comments_read on public.comments for select
  using (status = 'visible' or user_id = auth.uid() or public.is_admin());
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy comments_delete_own on public.comments for delete using (user_id = auth.uid());
create policy comments_admin on public.comments for all using (public.is_admin()) with check (public.is_admin());

-- likes
create policy likes_read on public.likes for select using (true);
create policy likes_insert on public.likes for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy likes_delete_own on public.likes for delete using (user_id = auth.uid());

-- testimonials
create policy testimonials_read on public.testimonials for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy testimonials_insert on public.testimonials for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy testimonials_admin on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

-- reports
create policy reports_insert on public.reports for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy reports_read on public.reports for select using (user_id = auth.uid() or public.is_admin());
create policy reports_admin on public.reports for update using (public.is_admin()) with check (public.is_admin());

-- logs e sincronização: só admin lê; escrita via service role (API) ou admin
create policy admin_logs_read on public.admin_logs for select using (public.is_admin());
create policy admin_logs_insert on public.admin_logs for insert with check (public.is_admin());
create policy sync_runs_read on public.drive_sync_runs for select using (public.is_admin());

-- Para tornar alguém administrador (rode manualmente, uma vez):
--   update public.profiles set role = 'ADMIN' where user_id = '<uuid-do-usuario>';
