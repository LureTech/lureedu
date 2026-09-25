# Falhas encontradas no esboço e como o novo sistema resolve

O esboço (`LURE_Growth___Área_de_Membros (1).html`) é uma página salva de um app React rodando em **modo demo**: sem banco, sem servidor, tudo guardado no navegador. Abaixo, o que foi encontrado ao desmontar o código e o que o sistema novo (Angular + Java) faz no lugar.

## Segurança e acesso

| # | Falha no esboço | No sistema novo |
|---|---|---|
| 1 | Login aceitava **qualquer e-mail e senha** e criava a conta como **administrador**. | Login real com senha criptografada (BCrypt), tokens JWT de 15 min e refresh token rotativo. Contas só são criadas por um admin. |
| 2 | Todas as permissões (admin, dono do post etc.) eram checadas **só na tela**. | Toda regra é validada no servidor: rotas `/api/admin/**` exigem ADMIN; apagar post/comentário exige ser o autor, o dono do post ou admin. |
| 3 | Dados (usuários, progresso, posts) ficavam no `localStorage` do navegador — sumiam ao trocar de aparelho. | Banco de dados (H2 em desenvolvimento, PostgreSQL em produção) com migrações Flyway. |
| 4 | "Manter-me conectado" não fazia nada. | Marcado: sessão de 30 dias (localStorage). Desmarcado: sessão de 12 h que termina ao fechar o navegador. |
| 5 | "Esqueceu a senha?" só abria o WhatsApp. | Fluxo de redefinição por e-mail com link de 1 h (continua havendo o contato no WhatsApp). Admin também pode redefinir a senha de qualquer conta. |
| 6 | Conta bloqueada continuava com acesso até o token expirar. | Bloqueio vale na hora: o servidor recusa qualquer requisição de conta bloqueada. |
| 7 | Sem limite de tentativas de login. | 5 tentativas erradas em 15 min bloqueiam temporariamente aquele e-mail. |

## Cursos, aulas e certificados

| # | Falha no esboço | No sistema novo |
|---|---|---|
| 8 | O catálogo da home era **fixo no código** (9 seções × 4 "Aula Teste"). Módulos criados no admin não apareciam — só trocavam a capa se o título fosse idêntico. | Seções e módulos vêm do banco. O que o admin cria aparece na hora. Seções também são gerenciáveis. |
| 9 | Existiam **dois sistemas paralelos** de curso (`/curso/:slug` com aulas numeradas e `/modulo/:id` com aulas do banco). | Um único modelo: Seção → Módulo → Aulas → Materiais / Prova. Uma única página de curso. |
| 10 | A contagem de aulas assumia **5 por padrão**; a "Prova Final" usava o número mágico 9999. | Contagem real de aulas; a prova é uma entidade própria. |
| 11 | A "Prova Final — Certificado" ficava **trancada para sempre**. | A prova libera quando todas as aulas são concluídas; nota mínima 70%; tentativas registradas. |
| 12 | O certificado era gerado com o nome **"Alvaro Paiva" fixo no código** e um código de verificação aleatório que não podia ser validado. | Certificado emitido pelo servidor com o nome real do aluno, data real e código único. Página pública `/certificado/{código}` para qualquer pessoa verificar. |
| 13 | Qualquer aluno podia gravar a duração do vídeo no banco. | Duração só é gravada se ainda não existir (admins podem sobrescrever). |
| 14 | O aluno tinha que marcar a aula manualmente mesmo assistindo até o fim. | A aula é concluída automaticamente quando o vídeo termina (ainda dá para marcar/desmarcar). |
| 15 | A ordem das seções era diferente entre a home e o admin. | Uma única ordem, definida no banco (`sortOrder`). |

## Comunidade

| # | Falha no esboço | No sistema novo |
|---|---|---|
| 16 | Nome e foto do autor eram **copiados** para o post e ficavam desatualizados quando a pessoa mudava o perfil. | Autor sempre lido do perfil atual. |
| 17 | Limites (500 caracteres, 10 posts/dia, 30 s entre posts) só existiam no texto da tela. | Validados no servidor, com mensagens claras. |
| 18 | "Novas publicações" dependia do tempo real do Supabase, que não existia no modo demo. | Verificação periódica no servidor (a cada 30 s) com aviso "N publicações novas". |

## Navegação e telas

| # | Falha no esboço | No sistema novo |
|---|---|---|
| 19 | A **busca** do topo não fazia nada. | Busca real em módulos e aulas, sem diferenciar acentos, com navegação por teclado. |
| 20 | O **sino** tinha um ponto vermelho fixo — não existiam notificações. | Notificações reais (curtidas, comentários, módulo novo, avisos de admin), com contador e "marcar como lidas". Preferências no perfil. |
| 21 | Botões "Ver todos" (seções) e "Ver benefícios" (Plano Premium) não faziam nada. | "Ver todos" abre a página da seção; "Ver benefícios" abre o modal de benefícios. |
| 22 | "Certificados" no menu levava para a aba de cursos em andamento. | Leva direto para a aba Certificados. |
| 23 | "Comunidade" não aparecia no menu lateral do desktop; o **Diagnóstico** não tinha link em lugar nenhum. | Ambos no menu (desktop e celular). |
| 24 | O item ativo do menu era fixo em "Início". | Destaca a página atual. |
| 25 | O diagnóstico não salvava o resultado — ao recarregar, perdia tudo. | Rascunho salvo enquanto responde; resultados salvos no servidor com histórico, e o plano de ação aponta para as seções recomendadas. |
| 26 | Página 404 e de erro em inglês. | Em português. |
| 27 | Notificações push dependiam de uma chave VAPID que nunca foi configurada (o recurso nunca funcionou). | Substituídas por notificações dentro do app. Push no celular fica como próxima etapa. |
