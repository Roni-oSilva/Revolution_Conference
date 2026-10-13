import { logoutAction } from '../actions';
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <div className="adm" style={{ maxWidth: 520 }}>
      <h1>Acesso negado</h1>
      <div className="msg err" role="alert">Esta conta não tem permissão de administrador (verificado no banco de dados).</div>
      <form action={logoutAction}><button className="btn" type="submit">Sair</button></form>
    </div>
  );
}
