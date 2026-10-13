import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
export const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');

export async function createDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(readFileSync(join(__dirname, 'shim.sql'), 'utf8'));
  for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
  }
  return db;
}

export type Actor = { role: 'anon' | 'authenticated' | 'service_role'; sub?: string };

/** Executa `fn` com o papel/JWT indicados (como o PostgREST faz) e SEMPRE volta para superusuário. */
export async function as<T>(db: PGlite, actor: Actor, fn: () => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ role: actor.role, ...(actor.sub ? { sub: actor.sub } : {}) });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${actor.role}`);
  try { return await fn(); } finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims', '', false)`); }
}

/** Retorna { ok } ou { error } sem lançar — facilita asserções sobre negações do RLS. */
export async function attempt(db: PGlite, sql: string, params: unknown[] = []) {
  try { const r = await db.query(sql, params); return { ok: true as const, rows: r.rows as any[], affected: r.affectedRows ?? 0 }; }
  catch (e: any) { return { ok: false as const, error: String(e.message || e), code: e.code as string | undefined }; }
}
