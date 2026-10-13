# Revolution Conference — site oficial

Site real, responsivo e seguro da Revolution Conference (Next.js 15 + TypeScript + Supabase). Substitui/aprimora o site estático da raiz do repositório **sem mexer nele**: este projeto vive na pasta `revolution-site/`.

> **Regra central:** o administrador controla todo o conteúdo. Visitantes só visualizam, reagem (❤️ 🙌 🔥 👏 😍) e abrem links oficiais. Não existe formulário de postagem, upload, comentário, resposta nem cadastro de links por visitantes.

## O que existe

| Área | O que faz |
|---|---|
| **Início** (`/`) | Banner, informações do evento, contagem regressiva (fuso configurável, padrão `America/Sao_Paulo`), **troca automática** de fase pré-evento → pós-abertura → encerrado **sem recarregar**, destaques, galeria (fotos do Google Drive) e botões para AO VIVO e MURAL. |
| **Ao Vivo** (`/ao-vivo`) | Player do YouTube (só quando o admin liga a transmissão; sem autoplay), mensagem quando não há live, vídeos gravados por categoria/ordem, links para o YouTube. |
| **Mural** (`/mural`, `/mural/[id]`) | Publicações oficiais, reações anônimas com contagem (Realtime + atualização periódica de reserva), compartilhar por link, paginação, estados de carregamento/erro/vazio. |
| **Painel** (`/admin`) | Login (Supabase Auth), dashboard real, evento/home, mural (criar, editar, ordenar, ocultar, restaurar, excluir), mídia (Drive e YouTube), segurança (limites, abusos, admins), pré-visualização antes de publicar. |
| Extras | `/privacidade`, `robots.txt`, `sitemap.xml`, Open Graph, CSP com nonce, cabeçalhos de segurança. |

## Estrutura

```
revolution-site/
├─ app/                    rotas (App Router): públicas, /admin, /api
│  ├─ api/reactions        POST (grava reação via service_role, só no servidor) · /mine · /api/time
│  └─ admin/               login, painel (grupo "(panel)"), server actions (actions.ts)
├─ components/             UI (PhaseGate, Countdown, Gallery, WallFeed…) e telas em components/views/
├─ lib/                    regra de negócio: urls, phase, tz, reactions, availability, data, admin/*
│  └─ supabase/            clientes: public (anon), server (sessão), service (service_role), browser (realtime)
├─ supabase/migrations/    0001 esquema · 0002 funções/triggers · 0003 RLS · 0004 realtime
├─ tests/                  unit (vitest) · db (RLS no Postgres) · e2e (Chromium + PostgREST real)
├─ docs/                   CONFIGURACAO · PUBLICACAO · SEGURANCA · TESTES
├─ middleware.ts           CSP com nonce + exigência de login em /admin
└─ .env.example
```

## Começando (desenvolvimento)

```bash
cd revolution-site
cp .env.example .env.local      # preencha as variáveis (veja docs/CONFIGURACAO.md)
npm install
npm run dev                     # http://localhost:3000
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run typecheck` | TypeScript estrito |
| `npm run test:unit` | testes unitários (URLs, fases, fusos, schemas, rota de reações, logs) |
| `npm run test:db` | RLS/triggers/funções das migrações em um Postgres real (PGlite) |
| `npm run tools:postgrest` | baixa o PostgREST usado só nos testes E2E |
| `npm run test:e2e` | `next build` + app + PostgREST + Chromium (precisa de `CHROME_PATH` ou do Chromium do Playwright) |
| `npm test` | tudo |

## Documentação

- [Configuração (Supabase, primeiro admin, variáveis, Drive, YouTube)](docs/CONFIGURACAO.md)
- [Publicação e atualização na Vercel](docs/PUBLICACAO.md)
- [Segurança, reações anônimas e limitações](docs/SEGURANCA.md)
- [Testes: o que é real e o que é simulado](docs/TESTES.md)
