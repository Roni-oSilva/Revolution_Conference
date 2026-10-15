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
