# Publicação e atualização (Vercel)

> O repositório já contém um site estático na **raiz** (`index.html`) que pode estar publicado. Este projeto Next.js está na pasta `revolution-site/` e **não altera** o site da raiz. Nada é publicado até você configurar a Vercel conforme abaixo.

## Publicar pela primeira vez

1. Configure o Supabase e anote as variáveis (`docs/CONFIGURACAO.md`).
2. Na Vercel: **Add New → Project** → importe o repositório do GitHub.
   - **Root Directory:** `revolution-site` (importante)
   - Framework: Next.js (detectado) · Build/Install/Output: padrão.
   - **Environment Variables:** as 5 variáveis de `.env.example` (Production e Preview).
3. **Deploy.** Para ficar no domínio já existente (`revolution-conference.vercel.app`), faça isso **no projeto Vercel existente**: *Settings → General → Root Directory = `revolution-site`* e *Settings → Git* na branch desejada. Antes, publique em um projeto/preview à parte e valide.
4. Defina `NEXT_PUBLIC_SITE_URL` com a URL final e redeploy.

### Verificar o que foi publicado (checklist)

- [ ] `/` abre, mostra a contagem e (depois da abertura) a fase nova sem recarregar.
- [ ] `/ao-vivo`, `/mural`, `/privacidade` abrem; `/robots.txt` bloqueia `/admin` e `/api`.
- [ ] `/admin` sem login redireciona para `/admin/login`; usuário comum cai em “acesso negado”.
- [ ] Reaja a uma publicação de teste: contagem muda; recarregue e a reação continua marcada.
- [ ] No painel, publique/oculte uma publicação e veja o efeito no site.
- [ ] `curl -I https://SEU-SITE/` mostra `content-security-policy` e `x-frame-options: DENY`.
- [ ] Nenhuma chave aparece no código-fonte da página (ver “Ver código-fonte” e a aba Rede).

## Atualizar

- Alterações de **conteúdo**: pelo painel (não exige deploy).
- Alterações de **código**: `git push` → a Vercel cria um *Preview* para cada branch/PR; faça *Promote to Production* (ou merge) depois de validar.
- **Migrações novas**: aplique no Supabase **antes** do deploy que depende delas (`supabase/migrations/NNNN_*.sql`, sempre em ordem).
- **Rollback**: Vercel → *Deployments* → deploy anterior → *Promote to Production*. Migrações não voltam sozinhas: escreva uma migração corretiva.

## Domínio
*Settings → Domains*. Atualize `NEXT_PUBLIC_SITE_URL` e, no Supabase, *Authentication → URL Configuration → Site URL*.
