import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, as, attempt } from './harness';

const OWNER = '00000000-0000-0000-0000-0000000000a1';
const EDITOR = '00000000-0000-0000-0000-0000000000a2';
const NOBODY = '00000000-0000-0000-0000-0000000000a3';
const owner = { role: 'authenticated', sub: OWNER } as const;
const editor = { role: 'authenticated', sub: EDITOR } as const;
const nobody = { role: 'authenticated', sub: NOBODY } as const;
const anon = { role: 'anon' } as const;
const service = { role: 'service_role' } as const;
const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';

let db: PGlite;
let published: string, draft: string, hidden: string;

beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users (id, email) values ('${OWNER}','o@x'),('${EDITOR}','e@x'),('${NOBODY}','n@x');
    insert into public.admin_users (user_id, role) values ('${OWNER}','owner'),('${EDITOR}','editor');`);
  const mk = async (status: string, body: string) =>
    (await db.query<{ id: string }>(`insert into public.wall_posts (body, status) values ($1, $2) returning id`, [body, status])).rows[0].id;
  published = await mk('published', 'publicado');
  draft = await mk('draft', 'rascunho');
  hidden = await mk('hidden', 'oculto');
  await db.exec(`insert into public.media (original_url, drive_file_id, is_published) values ('https://drive.google.com/file/d/AAAAAAAAAAAAA/view','AAAAAAAAAAAAA', true),
    ('https://drive.google.com/file/d/BBBBBBBBBBBBB/view','BBBBBBBBBBBBB', false);
    insert into public.videos (title, url, youtube_id, is_published) values ('v1','https://youtu.be/dQw4w9WgXcQ','dQw4w9WgXcQ', true),('v2','https://youtu.be/aaaaaaaaaaa','aaaaaaaaaaa', false);`);
});
afterAll(async () => { await db.close(); });

describe('leitura pública (anon)', () => {
  it('lê configurações do evento e do site', async () => {
    await as(db, anon, async () => {
      expect((await attempt(db, 'select name from public.event_settings')).ok).toBe(true);
      expect((await attempt(db, 'select site_title from public.site_settings')).rows).toHaveLength(1);
    });
  });
  it('programação: vê só itens publicados e não escreve', async () => {
    await db.exec(`insert into public.schedule_items (day_label, title, is_published) values ('Dia 1','pub',true),('Dia 1','rascunho',false)`);
    await as(db, anon, async () => {
      expect((await attempt(db, 'select title from public.schedule_items')).rows!.map((x) => x.title)).toEqual(['pub']);
      expect((await attempt(db, `insert into public.schedule_items (day_label, title) values ('x','y')`)).ok).toBe(false);
    });
    await as(db, editor, async () => {
      expect((await attempt(db, 'select 1 from public.schedule_items')).rows).toHaveLength(2);
      expect((await attempt(db, `insert into public.schedule_items (day_label, title) values ('Dia 2','novo')`)).ok).toBe(true);
    });
    await db.exec('delete from public.schedule_items');
  });
  it('vê somente publicações publicadas', async () => {
    const r = await as(db, anon, () => attempt(db, 'select id from public.wall_posts'));
    expect(r.rows!.map((x) => x.id)).toEqual([published]);
  });
  it('não vê rascunho/oculto nem mídia/vídeo não publicados', async () => {
    await as(db, anon, async () => {
      expect((await attempt(db, 'select 1 from public.media where is_published = false')).rows).toHaveLength(0);
      expect((await attempt(db, 'select 1 from public.videos where is_published = false')).rows).toHaveLength(0);
    });
  });
  it('não vê publicação agendada para o futuro', async () => {
    const id = (await db.query<{ id: string }>(`insert into public.wall_posts (body, status, published_at) values ('futuro','published', now() + interval '1 day') returning id`)).rows[0].id;
    const r = await as(db, anon, () => attempt(db, 'select 1 from public.wall_posts where id = $1', [id]));
    expect(r.rows ?? []).toHaveLength(0);
    await db.query('delete from public.wall_posts where id = $1', [id]);
  });
  it('admin vê rascunhos e ocultos', async () => {
    const r = await as(db, editor, () => attempt(db, 'select status from public.wall_posts order by status'));
    expect(r.rows!.map((x) => x.status)).toEqual(['draft', 'hidden', 'published']);
  });
});

describe('visitantes e usuários sem permissão NÃO escrevem', () => {
  const writes: [string, string][] = [
    ['insert wall_posts', `insert into public.wall_posts (body, status) values ('x','published')`],
    ['update wall_posts', `update public.wall_posts set body = 'hack'`],
    ['delete wall_posts', `delete from public.wall_posts`],
    ['insert media', `insert into public.media (original_url, drive_file_id) values ('https://drive.google.com/file/d/CCCCCCCCCCCCC/view','CCCCCCCCCCCCC')`],
    ['insert videos', `insert into public.videos (title, url, youtube_id) values ('t','https://youtu.be/bbbbbbbbbbb','bbbbbbbbbbb')`],
    ['update event_settings', `update public.event_settings set name = 'hack'`],
    ['update site_settings', `update public.site_settings set site_title = 'hack'`],
    ['insert admin_users', `insert into public.admin_users (user_id, role) values ('${NOBODY}','owner')`],
  ];
  for (const [name, sql] of writes) {
    it(`anon: ${name}`, async () => {
      const r = await as(db, anon, () => attempt(db, sql));
      expect(r.ok === false || (r as any).affected === 0).toBe(true);
    });
    it(`autenticado sem ser admin: ${name}`, async () => {
      const r = await as(db, nobody, () => attempt(db, sql));
      expect(r.ok === false || (r as any).affected === 0).toBe(true);
    });
  }
  it('nada foi alterado pelas tentativas', async () => {
    expect((await db.query<any>('select count(*)::int c from public.wall_posts')).rows[0].c).toBe(3);
    expect((await db.query<any>('select name from public.event_settings')).rows[0].name).toBe('Revolution Conference');
    expect((await db.query<any>('select count(*)::int c from public.admin_users')).rows[0].c).toBe(2);
  });
  it('autenticado sem admin não se promove nem lê admin_users alheios', async () => {
    const r = await as(db, nobody, () => attempt(db, 'select * from public.admin_users'));
    expect(r.rows ?? []).toHaveLength(0);
  });
});

describe('administração por função', () => {
  it('editor cria, edita, oculta, restaura e exclui publicações', async () => {
    await as(db, editor, async () => {
      const c = await attempt(db, `insert into public.wall_posts (body, status, position) values ('novo','draft',5) returning id`);
      expect(c.ok).toBe(true);
      const id = c.rows![0].id;
      expect((await attempt(db, `update public.wall_posts set status='published', body='editado' where id=$1`, [id])).ok).toBe(true);
      expect((await attempt(db, `update public.wall_posts set status='hidden' where id=$1`, [id])).ok).toBe(true);
      expect((await attempt(db, `update public.wall_posts set status='published' where id=$1`, [id])).ok).toBe(true);
      expect((await attempt(db, `delete from public.wall_posts where id=$1`, [id])).ok).toBe(true);
    });
  });
  it('published_at é preenchido ao publicar', async () => {
    const r = await attempt(db, `select published_at from public.wall_posts where id=$1`, [published]);
    expect(r.rows![0].published_at).not.toBeNull();
  });
  it('editor gerencia mídia e vídeos', async () => {
    await as(db, editor, async () => {
      expect((await attempt(db, `insert into public.media (original_url, drive_file_id) values ('https://drive.google.com/file/d/DDDDDDDDDDDDD/view','DDDDDDDDDDDDD')`)).ok).toBe(true);
      expect((await attempt(db, `update public.videos set position = 3`)).ok).toBe(true);
    });
  });
  it('editor NÃO gerencia admins', async () => {
    const r = await as(db, editor, () => attempt(db, `insert into public.admin_users (user_id, role) values ('${NOBODY}','editor')`));
    expect(r.ok).toBe(false);
  });
  it('owner gerencia admins', async () => {
    await as(db, owner, async () => {
      expect((await attempt(db, `insert into public.admin_users (user_id, role) values ('${NOBODY}','editor')`)).ok).toBe(true);
      expect((await attempt(db, `delete from public.admin_users where user_id='${NOBODY}'`)).ok).toBe(true);
    });
  });
  it('editor NÃO altera limites de segurança; owner altera', async () => {
    const e = await as(db, editor, () => attempt(db, `update public.site_settings set reaction_limit_per_minute = 999`));
    expect(e.ok).toBe(false);
    const ed = await as(db, editor, () => attempt(db, `update public.site_settings set tagline = 'ok'`));
    expect(ed.ok).toBe(true);
    const o = await as(db, owner, () => attempt(db, `update public.site_settings set reaction_limit_per_minute = 20`));
    expect(o.ok).toBe(true);
  });
  it('não permite remover/rebaixar o último owner', async () => {
    const r = await as(db, owner, () => attempt(db, `update public.admin_users set role='editor' where user_id='${OWNER}'`));
    expect(r.ok).toBe(false);
    const d = await as(db, owner, () => attempt(db, `delete from public.admin_users where user_id='${OWNER}'`));
    expect(d.ok).toBe(false);
  });
});

describe('restrições de dados (URLs, fuso, unicidade)', () => {
  it('rejeita URL javascript:/http e hosts fora da lista', async () => {
    const bad = [
      `insert into public.media (original_url, drive_file_id) values ('javascript:alert(1)','EEEEEEEEEEEEE')`,
      `insert into public.media (original_url, drive_file_id) values ('http://drive.google.com/file/d/E/view','EEEEEEEEEEEEE')`,
      `insert into public.media (original_url, drive_file_id) values ('https://evil.example/file/d/E/view','EEEEEEEEEEEEE')`,
      `insert into public.videos (title, url, youtube_id) values ('x','https://evil.example/watch?v=aaaaaaaaaaa','aaaaaaaaaab')`,
      `insert into public.videos (title, url, youtube_id) values ('x','javascript:alert(1)','aaaaaaaaaab')`,
      `update public.event_settings set stream_url = 'https://evil.example/live'`,
      `update public.event_settings set stream_video_id = 'curto'`,
      `update public.event_settings set maps_url = 'javascript:alert(1)'`,
      `update public.site_settings set instagram_url = 'data:text/html,x'`,
      `update public.event_settings set timezone = 'Mars/Olympus'`,
    ];
    for (const sql of bad) expect((await attempt(db, sql)).ok, sql).toBe(false);
  });
  it('aceita valores válidos', async () => {
    expect((await attempt(db, `update public.event_settings set stream_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ', stream_video_id='dQw4w9WgXcQ', timezone='America/Sao_Paulo'`)).ok).toBe(true);
  });
  it('unicidade de arquivo do Drive e de vídeo', async () => {
    expect((await attempt(db, `insert into public.media (original_url, drive_file_id) values ('https://drive.google.com/file/d/AAAAAAAAAAAAA/view','AAAAAAAAAAAAA')`)).ok).toBe(false);
    expect((await attempt(db, `insert into public.videos (title, url, youtube_id) values ('dup','https://youtu.be/dQw4w9WgXcQ','dQw4w9WgXcQ')`)).ok).toBe(false);
  });
  it('corpo vazio ou gigante é rejeitado', async () => {
    expect((await attempt(db, `insert into public.wall_posts (body) values ('   ')`)).ok).toBe(false);
    expect((await attempt(db, `insert into public.wall_posts (body) values (repeat('a', 2001))`)).ok).toBe(false);
  });
});

describe('reações anônimas', () => {
  const react = (post: string, anonId: string, emoji: string | null, ip = 'iphash1') =>
    as(db, service, async () => (await db.query<{ r: any }>(`select public.react_to_post($1,$2,$3,$4) r`, [post, anonId, emoji, ip])).rows[0].r);
  const counts = async (post: string) =>
    Object.fromEntries((await db.query<any>(`select emoji, count from public.post_reaction_counts where post_id=$1`, [post])).rows.map((r) => [r.emoji, r.count]));

  it('anon e authenticated NÃO executam a função de reação (só service_role)', async () => {
    for (const actor of [anon, nobody, editor]) {
      const r = await as(db, actor, () => attempt(db, `select public.react_to_post($1,$2,'🔥','x')`, [published, A1]));
      expect(r.ok, actor.role).toBe(false);
    }
  });
  it('registra, mantém uma por ID, troca e remove', async () => {
    expect((await react(published, A1, '🔥')).action).toBe('added');
    expect(await counts(published)).toMatchObject({ '🔥': 1 });
    expect((await react(published, A1, '🔥')).action).toBe('noop');
    expect(await counts(published)).toMatchObject({ '🔥': 1 });
    expect((await react(published, A1, '🙌')).action).toBe('changed');
    expect(await counts(published)).toMatchObject({ '🔥': 0, '🙌': 1 });
    expect((await react(published, A1, null)).action).toBe('removed');
    expect(await counts(published)).toMatchObject({ '🔥': 0, '🙌': 0 });
    expect((await react(published, A1, null)).action).toBe('noop');
    expect((await db.query<any>(`select count(*)::int c from public.post_reactions where post_id=$1`, [published])).rows[0].c).toBe(0);
  });
  it('IDs diferentes somam (limitação documentada: não garante uma por pessoa)', async () => {
    await react(published, A1, '❤️'); await react(published, A2, '❤️');
    expect((await counts(published))['❤️']).toBe(2);
    await react(published, A1, null); await react(published, A2, null);
  });
  it('emoji inválido, publicação inexistente/rascunho/oculta', async () => {
    expect((await react(published, A1, '💩')).error).toBe('invalid_emoji');
    expect((await react('99999999-9999-4999-8999-999999999999', A1, '🔥')).error).toBe('not_found');
    expect((await react(draft, A1, '🔥')).error).toBe('not_found');
    expect((await react(hidden, A1, '🔥')).error).toBe('not_found');
  });
  it('ninguém altera contagens ou reações diretamente', async () => {
    await react(published, A1, '😍');
    for (const actor of [anon, nobody, editor, owner]) {
      for (const sql of [
        `update public.post_reaction_counts set count = 9999`,
        `insert into public.post_reaction_counts (post_id, emoji, count) values ('${draft}','🔥',50)`,
        `delete from public.post_reaction_counts`,
        `insert into public.post_reactions (post_id, anon_id, emoji) values ('${published}','${A2}','🔥')`,
        `update public.post_reactions set emoji='🔥'`,
        `delete from public.post_reactions`,
      ]) {
        const r = await as(db, actor, () => attempt(db, sql));
        expect(r.ok === false || (r as any).affected === 0, `${actor.role}: ${sql}`).toBe(true);
      }
    }
    expect((await counts(published))['😍']).toBe(1);
    await react(published, A1, null);
  });
  it('visitante não lê reações brutas nem rate_limits; admin lê reações mas não rate_limits', async () => {
    await react(published, A1, '🔥');
    expect((await as(db, anon, () => attempt(db, 'select * from public.post_reactions'))).ok).toBe(false);
    expect((await as(db, anon, () => attempt(db, 'select * from public.rate_limits'))).ok).toBe(false);
    expect((await as(db, editor, () => attempt(db, 'select * from public.post_reactions'))).rows).toHaveLength(1);
    expect((await as(db, editor, () => attempt(db, 'select * from public.rate_limits'))).ok).toBe(false);
    await react(published, A1, null);
  });
  it('contagens são públicas', async () => {
    const r = await as(db, anon, () => attempt(db, 'select * from public.post_reaction_counts'));
    expect(r.ok).toBe(true);
  });
  it('limite por ID anônimo e por IP', async () => {
    await db.query('delete from public.rate_limits');
    await db.query(`update public.site_settings set reaction_limit_per_minute = 5, reaction_limit_per_ip_minute = 8`);
    const B = '33333333-3333-4333-8333-333333333333';
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await react(published, B, i % 2 ? '🔥' : '🙌', 'ipB')).error ?? 'ok');
    expect(results.filter((x) => x === 'ok')).toHaveLength(5);
    expect(results.filter((x) => x === 'rate_limited')).toHaveLength(2);
    // outro ID, mesmo IP: o limite por IP (8) pega depois do 8º acerto somado
    const outcomes = [];
    for (let i = 0; i < 6; i++) outcomes.push((await react(published, `44444444-4444-4444-8444-44444444444${i}`, '🔥', 'ipB')).error ?? 'ok');
    expect(outcomes).toContain('rate_limited');
    await db.query(`update public.site_settings set reaction_limit_per_minute = 20, reaction_limit_per_ip_minute = 120`);
    await db.query('delete from public.post_reactions'); await db.query('delete from public.rate_limits');
  });
  it('reações desativadas', async () => {
    await db.query(`update public.site_settings set reactions_enabled = false`);
    expect((await react(published, A1, '🔥')).error).toBe('disabled');
    await db.query(`update public.site_settings set reactions_enabled = true`);
  });
  it('minhas reações (somente service_role)', async () => {
    await react(published, A1, '👏');
    const r = await as(db, service, () => attempt(db, `select * from public.my_reactions($1, $2::uuid[])`, [A1, [published, draft]]));
    expect(r.rows).toEqual([{ post_id: published, emoji: '👏' }]);
    expect((await as(db, anon, () => attempt(db, `select * from public.my_reactions($1, $2::uuid[])`, [A1, [published]]))).ok).toBe(false);
    await react(published, A1, null);
  });
  it('excluir publicação remove reações e contagens (cascata)', async () => {
    const id = (await db.query<any>(`insert into public.wall_posts (body, status) values ('tmp','published') returning id`)).rows[0].id;
    await react(id, A1, '🔥');
    await db.query('delete from public.wall_posts where id = $1', [id]);
    expect((await db.query<any>('select count(*)::int c from public.post_reactions where post_id=$1', [id])).rows[0].c).toBe(0);
    expect((await db.query<any>('select count(*)::int c from public.post_reaction_counts where post_id=$1', [id])).rows[0].c).toBe(0);
  });
  it('ocultar impede novas reações; restaurar volta a permitir', async () => {
    await db.query(`update public.wall_posts set status='hidden' where id=$1`, [published]);
    expect((await react(published, A1, '🔥')).error).toBe('not_found');
    await db.query(`update public.wall_posts set status='published' where id=$1`, [published]);
    expect((await react(published, A1, '🔥')).action).toBe('added');
  });
});
