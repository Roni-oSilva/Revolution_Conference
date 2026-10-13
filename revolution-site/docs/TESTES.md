# Testes — o que é real e o que é simulado

Três camadas. Nenhum teste é marcado como aprovado sem ter sido executado; o resultado da última execução está no relatório final do projeto.

## 1. Unitários (`npm run test:unit` — Vitest)
Funções puras e a rota de reações com o cliente do Supabase **simulado**: parsing/validação de URLs (Drive/YouTube/https), cálculo de fase e fusos (inclui horário de verão histórico), schemas dos formulários, rota `POST /api/reactions` (origem, tamanho, validação, mapeamento de erros, hash do IP, logs sem dados pessoais) e verificações de disponibilidade com `fetch` simulado.

## 2. Banco / RLS (`npm run test:db`)
Aplica **as migrações reais** (`supabase/migrations`) em um Postgres de verdade (PGlite = Postgres compilado em WASM) com papéis `anon`, `authenticated` e `service_role` e funções `auth.uid()/auth.role()` equivalentes às do Supabase. Verifica: leitura pública só do publicado, bloqueio de escrita para visitantes e para usuários sem permissão, separação owner/editor, último owner, constraints de URL/fuso/unicidade, função de reação (adicionar, trocar, remover, idempotência, emoji inválido, post oculto, limites por ID/IP, reações desativadas), contagens inalteráveis por clientes, cascatas.
*Diferença para o Supabase real:* shim do esquema `auth` (apenas o necessário) e ausência de Storage/Realtime.

## 3. E2E (`npm run test:e2e` — Chromium + app em produção)
`next build` + `next start` → Chromium (Playwright) → **PostgREST 12 real** → Postgres (PGlite) com as migrações e o RLS.
- **Real:** app Next.js de produção (middleware, CSP, server actions, rotas), PostgREST validando **JWT assinado** e aplicando RLS, navegador.
- **Simulado:** o **Auth (GoTrue)** — servidor mínimo (`tests/e2e/infra.mjs`) que confere senha e emite JWT HS256 com o mesmo segredo do PostgREST; **não** testa e-mail de confirmação, recuperação de senha nem expiração real de sessão.
- **Não coberto:** **Realtime/WebSocket** (não existe no ambiente; testamos o fallback por consulta periódica e a ausência de erros), **Google Drive e YouTube reais** (a rede de teste não os alcança: validamos regras de URL, fallbacks de imagem, e a lógica de disponibilidade com `fetch` simulado; a verificação ao vivo cai em “não verificada”), **Vercel** (nada foi publicado) e navegadores além do Chromium.
- *Peculiaridade do banco de teste:* o PGlite derruba a conexão a cada erro SQL, então negações do RLS que geram erro aparecem como 5xx (no Supabase real são 401/403). Os testes verificam “resposta de erro **e** banco intacto”.
- Todas as consultas diretas dos testes passam por uma trava que as impede de se intercalar com o PostgREST (o PGlite tem uma única sessão).

### Cenários cobertos (E2E)
Navegação e abas · responsividade (360/768/1280, celular, alvos de toque) · teclado e diálogos · sem contagem regressiva · troca de fase automática sem recarregar · abrir/atualizar depois do horário · relógio do visitante errado · aba suspensa · fase encerrada / sem data · vídeos e links inválidos · Drive (galeria, fallback de imagem, cadastro pelo painel) · CRUD do painel (mural, mídia, vídeos, evento) · pré-visualização · bloqueio de postagem por visitantes (API real) · reações (registro, persistência, troca, remoção, duplicidade, abuso/429, desativadas) · rotas `/admin` (sem login, usuário comum, forjado) · RLS pela API · erros de rede e Supabase fora do ar · segredos não vazam.

## Como rodar
```bash
cd revolution-site && npm install
npm run tools:postgrest            # baixa o PostgREST (uma vez)
export CHROME_PATH=/caminho/do/chromium   # ou: npx playwright install chromium
npm test
ONLY="reações" npm run test:e2e    # filtra por nome
DEBUG_E2E=1 npm run test:e2e       # logs do PostgREST e do Next
```
