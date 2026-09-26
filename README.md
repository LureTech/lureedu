# AssessoriaLure — Área de Membros

Plataforma de cursos da Lure Digital: trilhas por seção, player de aulas, progresso, prova final, certificados verificáveis, comunidade, diagnóstico de maturidade e painel administrativo.

- **Frontend:** Angular 22 (standalone + signals, Tailwind CSS 4)
- **API:** TypeScript + Hono, rodando como função serverless na Vercel (`api/index.ts` → `server/`)
- **Banco:** PostgreSQL no Supabase (schema `lure`); arquivos enviados ficam na tabela `stored_files`
- **Publicação:** Vercel (site + API no mesmo projeto, `vercel.json`)

## Abrir no computador (Windows)

1. Dê dois cliques em **`iniciar.cmd`**.
2. O navegador abre em **http://localhost:4200**.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@lure.com.br` | `Lure@2026` |
| Aluno (demo) | `membro@lure.com.br` | `Membro@2026` |

Troque a senha do administrador no primeiro acesso (clique no seu nome → Editar perfil → Senha).

Os servidores ficam rodando em segundo plano. Para desligar, dê dois cliques em **`parar.cmd`**.

- **O que o `iniciar.cmd` faz:** usa o Node da pasta `.tools` (ou o Node 24.15+ do sistema, ou baixa um portátil, sem instalar nada no Windows) e sobe a API e o site. Na primeira vez instala as dependências.
- **Banco:** o mesmo Supabase da produção, configurado em `supabase.env` (não vai para o Git).
- **Logs:** ficam em `logs\` (`backend.log` é a API, `frontend.log` o site).
- **Portas:** API na **8085**, site na **4200**. A 8080 fica livre para outros projetos.

## Estrutura

```
api/         entrada da função da Vercel
server/      API em TypeScript — app.ts, routes/ (uma por área), lib/ (banco, login, arquivos), sql/
frontend/    App Angular — src/app/{core,shared,layout,pages}
docs/        API.md (contrato da API) e FALHAS-E-CORRECOES.md (o que foi corrigido do esboço)
scripts/     iniciar.ps1 / parar.ps1 (usados pelos .cmd) e setup-db.ts (prepara o banco)
backend/     API Java antiga — não é mais usada, fica só como referência
LURE_Growth___Área_de_Membros (1).html   esboço original (referência)
```

## Desenvolvimento

Requisito: **Node 24.15+** (ou use o da pasta `.tools`).

```bash
npm install
npm run dev:api        # API em http://localhost:8085 (lê o supabase.env)
npm run typecheck

cd frontend
npm install
npm start              # site em http://localhost:4200 (proxy de /api e /files para a 8085)
```

Banco novo ou restaurado: rode `npx tsx scripts/setup-db.ts` uma vez (cria a tabela `stored_files`).

## Publicar na Vercel

Cada push na branch `main` publica em https://lureedu.vercel.app. Variáveis do projeto (Settings → Environment Variables):

| Variável | Valor |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | iguais ao `supabase.env` |
| `JWT_SECRET` | texto aleatório com 32+ caracteres |
| `APP_FRONTEND_URL` | `https://lureedu.vercel.app` (link do e-mail de "esqueci a senha") |
| `WEBAUTHN_RP_ID` | `lureedu.vercel.app` (Face ID) |
| `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `MAIL_FROM` | SMTP (opcional) |

A Vercel limita cada envio a cerca de 4,5 MB: fotos, capas e materiais maiores que isso não sobem.

## Como usar

- **Vídeos:** cole na aula (Admin → Módulos → editar módulo) um link do YouTube (**Não listado**) ou o link público de um `.mp4` hospedado no Cloudflare R2 (10 GB grátis, sem custo de tráfego — veja [docs/VIDEOS.md](docs/VIDEOS.md)). O banco guarda só o link; o vídeo toca no player da LURE.
- **Certificado:** sai sozinho quando o aluno conclui todas as aulas e passa na prova final (se o módulo tiver prova, nota mínima 70%). Qualquer pessoa confere em `/certificado/<código>`.
- **Módulo "Em gravação":** trancado para alunos, que o veem como "Em breve". Ao liberar, todos os alunos recebem uma notificação.
- **Esqueci a senha:** envia e-mail se o SMTP estiver configurado; sem SMTP, o link aparece no log da API (`logs\backend.log` no computador, ou nos logs da Vercel). O admin também pode redefinir a senha de qualquer conta.
