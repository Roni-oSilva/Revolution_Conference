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
