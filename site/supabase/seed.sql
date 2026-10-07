insert into public.events (name, slug, description, start_date, end_date, status)
values ('Apaixonados pela Presença 2026', '2026',
  'Conferência Revolução Jovem Teen — Ulianópolis, PA',
  '2026-10-17T19:30:00-03:00', '2026-10-18T23:59:00-03:00', 'upcoming')
on conflict (slug) do nothing;
-- depois: update public.events set drive_folder_id = '<ID da pasta CONFERÊNCIA 2026>' where slug = '2026';
