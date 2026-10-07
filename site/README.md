# Apaixonados pela Presença — Experiência Digital da Conferência

React + TypeScript + Tailwind + shadcn · Supabase (Auth, Postgres, RLS) · Google Drive (mídia) · Vercel.

```
GOOGLE DRIVE → /api/drive-sync (Vercel, service role) → SUPABASE → SITE
```

O Drive guarda **só** fotos/vídeos. Curtidas, comentários, usuários e testemunhos ficam no Supabase.

## Rodar local
```
cd site && npm install && cp .env.example .env   # preencha
npm run dev
```
Sem `.env` o site abre (hero, galeria demo), mas login/comunidade ficam desativados.
Pré-visualizar fases: `/?fase=pre`, `/?fase=ao-vivo`, `/?fase=pos` ("VIVEMOS ISSO.").

## Configuração (uma vez)
1. **Supabase** — crie o projeto, rode `supabase/migrations/0001_schema.sql` e depois `supabase/seed.sql` no SQL Editor.
   Copie URL e `anon key` para `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
   Primeiro admin: cadastre-se no site e rode `update public.profiles set role='ADMIN' where user_id='<uuid>';`
2. **Google** — no Google Cloud ative a *Drive API*, crie uma *service account* e gere a chave JSON.
   Compartilhe a pasta `CONFERÊNCIA 2026/` com o e-mail da service account (Leitor). Para as miniaturas
   aparecerem a visitantes, a pasta também precisa estar como "qualquer pessoa com o link – Leitor".
   Estrutura esperada: `FOTOS/<Categoria>/…` e `VIDEOS/<Categoria>/…`.
3. **Vercel** — importe o repositório com *Root Directory* = `site`. Em *Settings → Environment Variables* (Production e Preview):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`.
   Deploy automático: `main` → Production, outras branches/PRs → Preview. Domínio: *Settings → Domains*.
4. **Supabase Auth** — em *Authentication → URL Configuration* adicione a URL de produção e `https://*-<seu-time>.vercel.app/**` (previews) e `http://localhost:5173`.
5. No site: **/admin → Google Drive** → informe a pasta → **SINCRONIZAR AGORA**.

## Segurança
- RLS em todas as tabelas; `is_admin()` no banco decide permissões (o front só esconde telas).
- `profiles.role/status` não podem ser alterados por usuário comum (trigger).
- Curtida única por conteúdo (`unique(user_id, photo_id|video_id)`).
- Rate limit de comentários/testemunhos/denúncias e sanitização (`< >`, controle) em triggers no banco; React escapa a saída (sem `dangerouslySetInnerHTML`).
- `/api/drive-sync` valida o JWT, exige ADMIN ativo, limita a 1 execução/30 s e registra em `admin_logs`.
- `SUPABASE_SERVICE_ROLE_KEY` e credenciais Google existem **apenas** em variáveis do servidor (sem prefixo `VITE_`). Headers de segurança/CSP em `vercel.json`.
- E-mail fica em `auth.users`; `profiles` só tem nome público.

## Eventos futuros
Tudo é escopado por `event_id`. Crie `/eventos/2027` em **Admin → Eventos**, informe a pasta do Drive e sincronize.

## Rotas
`/` · `/fotos` · `/fotos/:id` · `/videos` · `/comunidade` · `/eventos` · `/eventos/:slug` · `/login` · `/cadastro` · `/admin`
