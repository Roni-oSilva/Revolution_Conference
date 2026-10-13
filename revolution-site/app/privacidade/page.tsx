import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Política de privacidade' };

export default async function Page() {
  const c = createPublicClient();
  const site = c ? (await getSettings(c)).data?.site ?? null : null;
  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <span className="kicker">Transparência</span>
      <h1 className="page-title">Privacidade</h1>
      {site?.privacy_text ? <div style={{ whiteSpace: 'pre-wrap' }}>{site.privacy_text}</div> : (
        <div className="prose">
          <p>Este site é apenas informativo. Visitantes <strong>não criam conta, não enviam textos, fotos, comentários ou links</strong>: todo o conteúdo é publicado pela organização.</p>
          <h2>O que coletamos</h2>
          <ul>
            <li><strong>Reações (❤️ 🙌 🔥 👏 😍):</strong> ao reagir, guardamos o <em>ID aleatório</em> gerado no seu navegador (ele fica no armazenamento local do aparelho), a publicação e o emoji. Esse ID não contém nome, e-mail ou telefone e não identifica uma pessoa; limpar os dados do navegador gera outro ID. Por isso, <strong>não é possível garantir uma única reação por pessoa</strong>.</li>
            <li><strong>Limite de frequência (anti-abuso):</strong> usamos um <em>hash</em> irreversível e salgado do endereço IP, guardado por poucos minutos, apenas para limitar reações em excesso. Não guardamos o IP em claro nem o registramos em logs.</li>
            <li><strong>Sem cookies de rastreamento</strong> para visitantes. Cookies de sessão existem apenas para a equipe autorizada que acessa o painel administrativo.</li>
          </ul>
          <h2>Serviços de terceiros</h2>
          <ul>
            <li><strong>YouTube</strong> (modo de privacidade aprimorado, <code>youtube-nocookie.com</code>): vídeos e transmissões são carregados dos servidores do Google/YouTube e estão sujeitos à política deles.</li>
            <li><strong>Google Drive:</strong> as fotos são carregadas do Google. Seu navegador faz a requisição diretamente ao Google.</li>
            <li><strong>Supabase</strong> (banco de dados) e <strong>Vercel</strong> (hospedagem) processam os dados necessários ao funcionamento do site.</li>
          </ul>
          <h2>Seus direitos</h2>
          <p>Como não coletamos dados que identifiquem pessoas, não há dados pessoais para consultar ou excluir. Dúvidas podem ser enviadas pelos canais oficiais da conferência indicados no rodapé.</p>
          <p className="muted" style={{ fontSize: 13 }}>Texto-base. A organização deve revisá-lo (e, se desejar, substituí-lo no painel, em Evento → Texto da política de privacidade).</p>
        </div>
      )}
    </div>
  );
}
