import { requireAdmin } from '@/lib/admin/auth';
import { getSettings } from '@/lib/data';
import { inviteAdminAction, removeAdminAction, saveSecurityAction, setAdminRoleAction } from '../../actions';
import { Check, Field, Flash } from '../ui';

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { client, role, user } = await requireAdmin();
  const { m } = await searchParams;
  const since1h = new Date(Date.now() - 3600e3).toISOString(); const since24h = new Date(Date.now() - 86400e3).toISOString();
  const [s, admins, last24] = await Promise.all([
    getSettings(client), client.from('admin_users').select('user_id, role, created_at').order('created_at'),
    client.from('post_reactions').select('anon_id, created_at, updated_at').gte('updated_at', since24h).limit(5000),
  ]);
  const site = s.data?.site;
  const rows = (last24.data ?? []) as { anon_id: string; updated_at: string }[];
  const perAnon: Record<string, number> = {};
  for (const r of rows) perAnon[r.anon_id] = (perAnon[r.anon_id] ?? 0) + 1;
  const top = Object.entries(perAnon).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lastHour = rows.filter((r) => r.updated_at >= since1h).length;
  return (
    <>
      <Flash code={m} />
      <h2>Reações e limites</h2>
      <form action={saveSecurityAction} className="card f">
        <Check label="Reações ativas" name="reactions_enabled" checked={site?.reactions_enabled} />
        <Field label="Limite por ID anônimo (por minuto)" name="reaction_limit_per_minute" type="number" defaultValue={site?.reaction_limit_per_minute} help="1–300" />
        <Field label="Limite por IP (hash) por minuto" name="reaction_limit_per_ip_minute" type="number" defaultValue={site?.reaction_limit_per_ip_minute} help="1–3000" />
        <div className="field wide"><button className="btn solid small" type="submit">Salvar limites</button>
          <small>Somente o <strong>owner</strong> consegue salvar (o banco recusa editores, mesmo que a tela permita o clique). Você é: <code>{role}</code>.</small></div>
      </form>
      <div className="card">
        <h3>Sinais de abuso (últimas 24 h)</h3>
        <p style={{ margin: 0 }}>Reações na última hora: <strong>{lastHour}</strong> · IDs anônimos ativos em 24 h: <strong>{Object.keys(perAnon).length}</strong></p>
        {top.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>IDs com mais reações: {top.map(([id, n]) => `${id.slice(0, 8)}… (${n})`).join(', ')}</p>}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Um mesmo ID só pode ter 1 reação por publicação, mas pessoas diferentes (ou o mesmo navegador após limpar dados) podem gerar IDs diferentes.</p>
      </div>

      <h2>Administradores</h2>
      <div className="card scroll">
        <table className="t"><thead><tr><th>Usuário</th><th>Função</th><th>Desde</th><th>Ações</th></tr></thead><tbody>
          {(admins.data ?? []).map((a: any) => (
            <tr key={a.user_id}><td><code>{String(a.user_id).slice(0, 8)}…</code>{a.user_id === user.id ? ' (você)' : ''}</td><td>{a.role}</td><td>{String(a.created_at).slice(0, 10)}</td>
              <td>{role === 'owner' && a.user_id !== user.id ? (
                <div className="row">
                  <form action={setAdminRoleAction}><input type="hidden" name="user_id" value={a.user_id} /><input type="hidden" name="role" value={a.role === 'owner' ? 'editor' : 'owner'} /><button className="btn small" type="submit">Tornar {a.role === 'owner' ? 'editor' : 'owner'}</button></form>
                  <form action={removeAdminAction}><input type="hidden" name="user_id" value={a.user_id} /><button className="btn small" type="submit">Remover</button></form>
                </div>) : <span className="muted">—</span>}</td></tr>
          ))}
        </tbody></table>
      </div>
      {role === 'owner' ? (
        <form action={inviteAdminAction} className="card f">
          <Field label="E-mail de um usuário já criado no Supabase (Authentication → Users)" name="email" type="email" required wide />
          <div className="field"><label>Função</label><select name="role" defaultValue="editor"><option value="editor">editor (conteúdo)</option><option value="owner">owner (admins e segurança)</option></select></div>
          <div className="field wide"><button className="btn solid small" type="submit">Adicionar administrador</button></div>
        </form>
      ) : <p className="muted">Somente owners gerenciam administradores.</p>}
    </>
  );
}
