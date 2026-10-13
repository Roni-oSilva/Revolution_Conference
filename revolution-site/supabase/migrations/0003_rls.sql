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
