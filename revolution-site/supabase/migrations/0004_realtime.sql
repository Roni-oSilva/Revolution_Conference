-- Realtime somente no necessário: novas publicações e contagens de reações.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.post_reaction_counts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.wall_posts; exception when duplicate_object then null; end;
  end if;
end $$;
