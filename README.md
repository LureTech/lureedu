# AssessoriaLure — Área de Membros

Plataforma de cursos da Lure Digital: trilhas por seção, player de aulas, progresso, prova final, certificados verificáveis, comunidade, diagnóstico de maturidade e painel administrativo.

- **Frontend:** Angular 22 (standalone + signals, Tailwind CSS 4)
- **Backend:** Java 21 + Spring Boot 3.5 (Spring Security com JWT, JPA, Flyway)
- **Banco:** H2 em arquivo no desenvolvimento, PostgreSQL em produção

## Abrir no computador (Windows)

1. Dê dois cliques em **`iniciar.cmd`**.
2. O navegador abre em **http://localhost:4200**.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@lure.com.br` | `Lure@2026` |
| Aluno (demo) | `membro@lure.com.br` | `Membro@2026` |

Troque a senha do administrador no primeiro acesso (clique no seu nome → Editar perfil → Senha).

Os servidores ficam rodando em segundo plano. Para desligar, dê dois cliques em **`parar.cmd`**.

- **O que o `iniciar.cmd` faz:** usa o Java e o Node da pasta `.tools`. Se ela não existir, ele usa Java 21 e Node 24.15+ do sistema ou baixa versões portáteis, sem instalar nada no Windows. Na primeira vez também compila o backend e instala as dependências do frontend.
- **Logs:** ficam em `logs\` (`backend.log`, `frontend.log`).
- **Dados:** banco e arquivos enviados ficam em `backend\data\`. Apague essa pasta para começar do zero; a conta admin, as seções e os módulos de exemplo são recriados.
- **Portas:** backend na **8085**, site na **4200**. A 8080 fica livre para outros projetos.

## Estrutura

```
backend/     API Java (Spring Boot) — pacote br.com.lure.growth
frontend/    App Angular — src/app/{core,shared,layout,pages}
docs/        API.md (contrato da API) e FALHAS-E-CORRECOES.md (o que foi corrigido do esboço)
scripts/     iniciar.ps1 / parar.ps1 (usados pelos .cmd)
docker-compose.yml, .env.example   produção com Docker
LURE_Growth___Área_de_Membros (1).html   esboço original (referência)
```

## Desenvolvimento

Requisitos: **Java 21** e **Node 24.15+** (ou use os da pasta `.tools`).

```bash
# Backend — http://localhost:8085
cd backend
./mvnw test                 # 26 testes de integração
./mvnw spring-boot:run      # ou: ./mvnw -DskipTests package && java -jar target/growth.jar

# Frontend — http://localhost:4200 (proxy de /api e /files para a 8085)
cd frontend
npm install
npm start
```

Variáveis do backend: `PORT`, `JWT_SECRET`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `STORAGE_DIR`, `APP_FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_DEMO`, `SPRING_MAIL_*`, `MAIL_FROM`. Detalhes em `backend/src/main/resources/application*.properties`.

## Produção com Docker

```bash
cp .env.example .env        # preencha senhas e JWT_SECRET
docker compose up -d --build
```

O site sobe em http://localhost:8081, com PostgreSQL, backend e nginx servindo o Angular. Os arquivos Docker ainda **não foram testados** (o Docker não estava rodando nesta máquina); teste antes de publicar.

## Como usar

- **Vídeos:** cole na aula (Admin → Módulos → editar módulo) um link do YouTube (**Não listado**) ou o link público de um `.mp4` hospedado no Cloudflare R2 (10 GB grátis, sem custo de tráfego — veja [docs/VIDEOS.md](docs/VIDEOS.md)). O banco guarda só o link; o vídeo toca no player da LURE.
- **Certificado:** sai sozinho quando o aluno conclui todas as aulas e passa na prova final (se o módulo tiver prova, nota mínima 70%). Qualquer pessoa confere em `/certificado/<código>`.
- **Módulo "Em gravação":** trancado para alunos, que o veem como "Em breve". Ao liberar, todos os alunos recebem uma notificação.
- **Esqueci a senha:** envia e-mail se o SMTP estiver configurado; sem SMTP, o link aparece no `logs\backend.log`. O admin também pode redefinir a senha de qualquer conta.
