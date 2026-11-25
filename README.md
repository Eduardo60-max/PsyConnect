# PsyConnect — Fase 2 (Funcional)

Plataforma de apoio emocional, grupos comunitários, agendamento de sessões e coleta de métricas UX (PANAS), com servidor Bun, banco e autenticação no Supabase (Postgres + Auth) e app Android empacotado via Capacitor.

## 1. Banco de dados e autenticação (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No **SQL Editor** do Supabase, execute o arquivo de migração versionado em [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql).
3. Em **Authentication → URL Configuration**:
   - **Site URL**: URL pública do site publicado (ou `http://localhost:3000` em desenvolvimento).
   - **Redirect URLs**: adicione a URL do site e `com.psyconnect.app://auth-callback` (para abrir o app Android nos links de confirmação de e-mail e troca de senha).
4. Copie `.env.example` para `.env` e preencha:
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY` (e `BUN_PUBLIC_SUPABASE_URL` / `BUN_PUBLIC_SUPABASE_ANON_KEY` se fizer build estático)
   - `SUPABASE_SERVICE_ROLE_KEY` (**apenas no servidor** — nunca colocar no frontend ou APK)
   - `CORS_ORIGINS` (domínio do site publicado + `capacitor://localhost,https://localhost`)
   - `ADMIN_EMAILS` (e-mails separados por vírgula que terão acesso ao painel administrativo)

## 2. Rodar localmente (API + Web)

```powershell
bun install
bun run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## 3. Publicar a API no Railway

1. No Railway, crie um projeto a partir deste repositório. O `Dockerfile` e o `railway.json` na raiz configuram a compilação, a porta e a verificação de saúde.
2. Em **Variables**, configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` com os valores do projeto Supabase. Guarde `SUPABASE_SERVICE_ROLE_KEY` somente como variável secreta do Railway; nunca a coloque no app ou no APK.
3. Configure `CORS_ORIGINS` como `capacitor://localhost,https://localhost` e inclua também a origem HTTPS do site web, se houver. Configure `ADMIN_EMAILS` com os e-mails de administradores, separados por vírgula.
4. Gere um domínio público HTTPS para o serviço no Railway e confirme que `https://SEU-DOMINIO/api/public-config` responde.
5. Em **Supabase → Authentication → URL Configuration**, inclua `com.psyconnect.app://auth-callback` nas URLs de redirecionamento.

O Railway fornece a variável `PORT` automaticamente. A API escuta nessa porta e vincula o servidor a `0.0.0.0`.

## 4. Build de produção e Android (Capacitor)

Para gerar o bundle web apontando para a API hospedada em HTTPS:

```powershell
$env:BUN_PUBLIC_API_URL="https://SEU-DOMINIO.up.railway.app"
bun run mobile:sync
```

Para gerar o APK de teste diretamente no terminal (na pasta `android`):

```powershell
cd android
./gradlew assembleDebug
```

> O APK de depuração é assinado para testes. **Importante:** guarde o arquivo `.keystore` de assinatura de produção fora do Git e com cópia segura.

## 5. Rotas da API (`/api/...`)

Todas as rotas autenticadas exigem o cabeçalho `Authorization: Bearer <access_token>` do Supabase Auth. A identidade (`user.id`, papel `paciente`/`medico`/`admin`) é sempre carregada do token no servidor.

- **Configuração e Auth guard**: `GET /api/public-config`, `POST /api/auth/login-guard`, `GET /api/me`, `PUT /api/me/profile`
- **Profissionais e Disponibilidade**: `GET /api/professionals`, `PUT /api/pro/profile`, `GET /api/pro/availability`, `POST /api/pro/availability`, `DELETE /api/pro/availability/:id`
- **Comunidades, Feed, Curtidas, Comentários e Desafios**: `GET /api/feed`, `GET /api/groups`, `POST /api/groups`, `POST /api/groups/:id/join`, `GET /api/groups/:id/posts`, `POST /api/groups/:id/posts`, `DELETE /api/posts/:id`, `POST /api/posts/:id/like`, `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`, `DELETE /api/comments/:id`, `GET /api/groups/:id/challenge-days`, `POST /api/groups/:id/challenge-days/:day`, `GET /api/groups/:id/challenge-ranking`
- **Diário de Humor**: `GET /api/mood`, `POST /api/mood`
- **Agendamentos**: `GET /api/bookings`, `POST /api/bookings`, `POST /api/bookings/:id/cancel`, `POST /api/bookings/:id/reschedule`, `GET /api/pro/bookings`, `POST /api/pro/bookings/:id/cancel`, `POST /api/pro/bookings/:id/reschedule`
- **Mensagens**: `GET /api/conversations`, `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`, `GET /api/pro/chats`, `POST /api/pro/chats/:id/messages`
- **Segurança (Denúncia e Bloqueio)**: `GET /api/blocks`, `POST /api/blocks`, `DELETE /api/blocks/:userId`, `POST /api/reports`
- **Métricas de IHC (PANAS)**: `GET /api/surveys/panas/me`, `POST /api/surveys/panas`
- **Administração**: `GET /api/admin/doctors`, `POST /api/admin/doctors/:id/review`, `GET /api/admin/reports`, `POST /api/admin/reports/:id/resolve`, `GET /api/admin/surveys`, `GET /api/admin/surveys/csv`
