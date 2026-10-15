# Segurança

## Modelo
| Quem | Pode |
|---|---|
| Visitante (anônimo) | **Ler** conteúdo publicado; **reagir** (por rota de servidor); abrir links oficiais. Nada mais. |
| Quem sabe a senha do painel | Tudo no `/admin`: conteúdo, programação, mídia, evento/home e limites das reações. |

**Painel com senha única (decisão do projeto: simples, sem contas).** A senha vem de `ADMIN_PASSWORD` (nunca vai para o código nem para o GitHub). O login grava um cookie `httpOnly` assinado (HMAC) que vale 12 h; cada página/ação do painel confere o cookie no servidor e depois escreve no banco com a `service_role` (que ignora o RLS). Há limite de 8 tentativas erradas por IP a cada 15 min.
Limitações assumidas: uma senha compartilhada não identifica quem fez cada mudança, e uma senha numérica curta é fácil de adivinhar com tentativas em massa vindas de vários IPs. Use uma senha longa se o conteúdo for sensível.

## Banco (RLS)
- RLS ligado em **todas** as tabelas; privilégios revogados e concedidos só ao necessário.
- `wall_posts`, `media`, `videos`: visitante só lê `published`/não ocultos (e publicações agendadas só depois da hora).
- `post_reaction_counts`: leitura pública, **nenhuma** policy de escrita — só o trigger `SECURITY DEFINER` altera.
- `post_reactions`: só admin lê; ninguém escreve direto.
- `rate_limits`: sem acesso para `anon`/`authenticated`.
- `react_to_post` e `my_reactions`: **só `service_role`** pode executar.
- Campos de segurança (`reaction_limit_*`, `reactions_enabled`): pela API pública só o `owner` do banco altera (o painel usa a `service_role`).
- Constraints: URLs `https`, domínios do Drive/YouTube, IDs, tamanhos, unicidade (`drive_file_id`, `youtube_id`).

## Reações anônimas (e por que não garantem “uma por pessoa”)
- O navegador gera um **UUID aleatório** (`localStorage`, chave `rv_anon_id`). Ao reagir, o site chama `POST /api/reactions` (mesma origem); o servidor valida (zod, origem, tamanho) e chama `react_to_post` com a `service_role` **que nunca sai do servidor**.
- Garantias: **uma reação por (publicação, ID anônimo)**, troca e remoção, idempotência, limite por ID e por IP (hash salgado `sha256(RATE_LIMIT_SALT|ip)`, janela de 1 min, linhas apagadas após ~10 min), emoji restrito aos 5, só publicações publicadas.
- **Limitações assumidas:** quem limpa os dados do navegador, usa outro navegador/aparelho ou modo anônimo ganha outro ID e pode reagir de novo; um script que gere muitos IDs é contido apenas pelo **limite por IP** (que também pode ser contornado com muitos IPs). Portanto as contagens são **indicadores de engajamento, não votos auditáveis**. Para votação séria, exija login.

## Navegador
- **CSP com nonce** (`middleware.ts`): `script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-src` só `youtube-nocookie.com`, `object-src 'none'`, `frame-ancestors 'none'`, sem `unsafe-eval` em produção. `style-src` mantém `'unsafe-inline'` (necessário ao Next/React para estilos).
- Texto do mural é renderizado como **texto** (React escapa; sem `dangerouslySetInnerHTML`).
- Links externos vindos do banco passam por `isSafeHttpsUrl` (só `https`, sem credenciais, sem `javascript:`/`data:`); `rel="noopener noreferrer"`.
- Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.

## Segredos e logs
- `SUPABASE_SERVICE_ROLE_KEY` e `RATE_LIMIT_SALT` só no servidor (`import 'server-only'`); teste E2E confirma que não vazam em HTML/JS/JSON público.
- Logs (`lib/logger.ts`) são JSON e **removem** chaves como ip, email, anon, token, authorization; nunca registram IP, ID anônimo nem texto de visitantes.
- O painel usa cookies de sessão do Supabase (httpOnly via `@supabase/ssr`); visitantes não recebem cookies.

## Pendências de segurança conhecidas
- Dependências: `npm audit` aponta avisos em **PostCSS embutido no Next 15** (cadeia de build, não processa CSS de visitantes) e em ferramentas de teste (vitest). A correção exige Next 16 (mudança maior). Acompanhe e atualize o Next quando validado.
- O limite por IP depende de `x-forwarded-for` (Vercel o define). Atrás de outro proxy, ajuste `clientIp()`.
- Não há CAPTCHA; o abuso é contido por limites. Se virar problema, adicione Turnstile/hCaptcha na rota de reações.
