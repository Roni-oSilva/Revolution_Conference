-- Álbum da foto (ex.: "Dia 1", "Dia 2"): usado nas pastas da home e no filtro da galeria.
alter table public.media add column if not exists album text not null default '' check (char_length(album) <= 60);
create index if not exists media_album_idx on public.media (album) where is_published;
