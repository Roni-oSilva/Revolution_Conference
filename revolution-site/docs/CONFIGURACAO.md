# Configuração

Siga na ordem. Nada aqui exige serviços pagos, mas **confira os limites atuais dos planos gratuitos** antes do evento (veja o fim deste arquivo).

## 1. Supabase (banco, autenticação do painel, Realtime)

1. Crie um projeto em <https://supabase.com> (região mais próxima do público; guarde a senha do banco).
2. **SQL Editor** → rode, **nesta ordem**, o conteúdo de cada arquivo de `supabase/migrations/`:
   `0001_schema.sql` → `0002_functions_triggers.sql` → `0003_rls.sql` → `0004_realtime.sql` → `0005_media_album.sql` → `0006_schedule.sql`.
   (Ou, com a CLI: `supabase link --project-ref SEU_REF && supabase db push`.)
3. **Dados reais do evento** (rode uma vez, depois das migrações, também no SQL Editor): `supabase/seed_evento.sql` (local, mapa, datas, Instagram, YouTube) e `supabase/seed_programacao.sql` (programação dos dois dias).
   *Não é preciso configurar Authentication: o painel usa só a senha `ADMIN_PASSWORD`.*
4. **Project Settings → API**: copie *Project URL*, a chave **anon public** e a **service_role** (esta última é secreta).
5. **Database → Replication** (ou *Realtime*): confirme que `post_reaction_counts` e `wall_posts` estão na publicação `supabase_realtime` (a migração 0004 faz isso). Sem isso as contagens ainda atualizam por consulta periódica (a cada 20 s), mas não instantaneamente.

### Acesso ao painel (senha única)

O painel `/admin` abre com **uma única senha**, definida na variável de ambiente **`ADMIN_PASSWORD`** (Vercel → Settings → Environment Variables, ou `.env.local`). Não há e-mail nem conta de usuário. Sem `ADMIN_PASSWORD` o painel fica **desligado**.
Depois do login o servidor grava no banco com a chave `SUPABASE_SERVICE_ROLE_KEY` (obrigatória). Para trocar a senha, mude a variável e faça novo deploy (os logins antigos deixam de valer).

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` (dev) e cadastre as mesmas na Vercel (*Project → Settings → Environment Variables*, marcando Production/Preview).

| Variável | Onde aparece | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador + servidor | chave pública; a proteção é o RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | usada em `/api/reactions` e em TODAS as gravações do painel `/admin`. **Nunca** com prefixo `NEXT_PUBLIC_`. |
| `RATE_LIMIT_SALT` | **somente servidor** | texto aleatório longo (`openssl rand -hex 32`) para o hash do IP |
| `NEXT_PUBLIC_SITE_URL` | navegador + servidor | URL pública (sitemap, Open Graph, origem permitida nas reações) |
| `ADMIN_PASSWORD` | **somente servidor** | senha única do painel `/admin` (sem ela o painel fica desligado) |

> Depois de alterar variáveis na Vercel, faça um novo deploy (as `NEXT_PUBLIC_*` são embutidas no build).

## 3. Google Drive (fotos)

O site **não usa a API do Google Drive** (não há credenciais do Google a configurar). A integração é por **links de arquivo públicos**:

1. Suba as fotos no Drive (organize como quiser: `REVOLUTION/FOTOS`, `DIA-01`…).
2. Para cada foto: botão direito → **Compartilhar** → *Acesso geral* = **Qualquer pessoa com o link** (Leitor) → **Copiar link**.
3. Painel → **Mídia → Fotos** → cole o link do **arquivo** (links de **pasta** são recusados) → o servidor verifica se o Drive entrega a miniatura publicamente:
   - ✅ pública → publicada automaticamente;
   - ⚠️ indisponível (privada/removida) → cadastrada **fora do site** com aviso; torne pública e clique **Verificar de novo**;
   - ❔ não verificada (Google inacessível no momento) → cadastrada sem publicar; use *Verificar de novo* ou marque “Publicada” se tiver certeza.
4. Só links `https://drive.google.com/…` ou `https://docs.google.com/…` são aceitos. O site mostra as imagens pelas miniaturas do próprio Drive (`/thumbnail?id=…&sz=wN`, em vários tamanhos) e, se uma imagem falhar no navegador, exibe “Imagem indisponível” sem quebrar a página.

Limitação: o Drive pode limitar muitas requisições seguidas por arquivo/IP; para um evento grande, considere poucas fotos de destaque por vez. **Sincronização automática de pasta não existe** — cada foto é cadastrada no painel.

*(Se no futuro quiser listar uma pasta automaticamente, será preciso a Google Drive API com uma conta de serviço — chave JSON guardada só em variável de ambiente do servidor, pasta compartilhada com o e-mail da conta. Isso **não** está implementado.)*

## 4. YouTube (lives e vídeos)

Fluxo da transmissão: **câmera → OBS Studio → YouTube Live → site**. O site não hospeda vídeo.

1. No YouTube Studio, crie a live (ou “estreia”). **Permita incorporação** (*Detalhes → Mostrar mais → Permitir incorporação*) e deixe como **Pública** ou **Não listada** (privada não abre).
2. Painel → **Mídia → Transmissão ao vivo**: cole o link (ou o ID de 11 caracteres), marque **Transmissão LIGADA** e salve. *Só* a chave “ligada” faz o player aparecer — ter um link salvo não basta. Desmarque quando acabar.
3. **Vídeos gravados**: *Mídia → Vídeos gravados* → link + título + categoria (Pregações, Louvor, Bastidores, Entrevistas, Melhores momentos, ou outra). O servidor consulta o *oEmbed* do YouTube: vídeo privado/removido/sem incorporação é marcado como **indisponível** e fica fora do site (use *Verificar de novo* depois de corrigir).
4. Só domínios do YouTube são aceitos e só o player oficial em modo de privacidade aprimorado (`youtube-nocookie.com`) é incorporado. Se o player não abrir (rede/bloqueio), sempre há o botão **Abrir no YouTube**.

## 5. Conteúdo inicial

- **Evento e home** (`/admin/evento`): nome, descrição, fuso, data do evento, **abertura** (momento da troca de fase), encerramento, local, mapa, banner, redes e texto de privacidade.
- **Mural** (`/admin/mural`): crie rascunhos, **pré-visualize** (`Pré-visualizar`) e publique.
- Nenhuma data é presumida: enquanto a **abertura** não for definida em `/admin/evento`, o site fica na fase “pré-evento” e mostra “Data de abertura a confirmar”.

## 6. Limites dos planos gratuitos (conferir antes do evento)

Não foi possível consultar as páginas oficiais a partir do ambiente de desenvolvimento, então **este projeto não afirma números**. Verifique em <https://supabase.com/pricing> e <https://vercel.com/docs/limits> (e na documentação do YouTube/Drive), em especial: tamanho do banco e do egress do Supabase Free; **pausa automática de projetos inativos no Supabase Free** (acorde/mantenha o projeto ativo antes do evento); conexões e mensagens do Realtime; limites de requisições/banda da Vercel Hobby e a regra de **uso não comercial** do plano Hobby; limites de verificação/transmissão do YouTube e de tráfego por arquivo no Drive. Não há garantia de disponibilidade ilimitada.
