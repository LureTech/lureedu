# LURE Growth — Área de Membros (frontend)

Angular 22 (standalone, signals, zoneless) + Tailwind CSS v4 (via PostCSS). Toda a interface é em PT-BR.
O contrato com o backend (Spring Boot) está em [`../docs/API.md`](../docs/API.md).

## Requisitos

- **Node.js ≥ 24.15** (ou 22.22.3+) — exigência do Angular CLI 22. Com Node 24.11 o CLI recusa rodar.
- Backend rodando em `http://localhost:8085` para desenvolvimento.

## Comandos

```bash
npm install          # dependências
npm start            # ng serve em http://localhost:4200 (com proxy para o backend)
npx ng build         # build de produção em dist/frontend/browser
```

## Proxy de desenvolvimento

`proxy.conf.json` (ligado em `angular.json → serve.options.proxyConfig`) envia:

| Caminho   | Destino                 |
|-----------|-------------------------|
| `/api/**` | `http://localhost:8085` |
| `/files/**` | `http://localhost:8085` |

As chamadas usam URLs relativas (`/api/...`), então em produção basta o nginx fazer o mesmo roteamento
e servir `dist/frontend/browser` com fallback para `index.html` (SPA).

## Estrutura

```
src/app/
  core/      modelos (DTOs do contrato), auth (serviço, interceptor, guards), APIs por feature,
             stores (progresso, notificações), toast, confirmação, UI global
  shared/    ícones, avatar, spinner, anel de progresso, cards de módulo, modal, diálogo de confirmação,
             LURE Player (YouTube IFrame API), compressão de imagem, YouTube utils, certificado em canvas
  layout/    shell autenticado: sidebar, top bar, busca, sino de notificações, barras mobile,
             modal de perfil e modal de benefícios
  pages/     login, redefinir senha, verificação pública de certificado, home, seção, curso,
             meus cursos, comunidade, diagnóstico, admin (contas, módulos, editor) e 404
```

## Rotas

| Rota | Acesso |
|---|---|
| `/login` | visitante |
| `/redefinir-senha?token=` | público |
| `/certificado/:code` | público |
| `/` · `/secao/:id` · `/curso/:slug?aula=` · `/meus-cursos?tab=` · `/comunidade` · `/diagnostico` | logado |
| `/admin` · `/admin/modulos` · `/admin/modulos/:id` | admin |

Sessão: tokens no `localStorage` com "Manter-me conectado", senão no `sessionStorage`; o interceptor
faz um único refresh ao receber 401 e repete a requisição.
