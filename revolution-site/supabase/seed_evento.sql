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
  youtube_channel_url = 'https://www.youtube.com/@evangelhoplenoulianopolis'
where id = 1;
