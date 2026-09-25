package br.com.lure.growth.seed;

import java.util.List;

/**
 * Conteúdo de demonstração: seções padrão e 2 módulos por seção (aulas sem vídeo — o admin cadastra depois).
 */
final class DemoContent {

    private DemoContent() {
    }

    record SectionSeed(String id, String title, String subtitle) {
    }

    record LessonSeed(String title, String description) {
    }

    record QuestionSeed(String text, List<String> options, int correctIndex) {
    }

    record CourseSeed(String sectionId, String title, String description, boolean locked, List<LessonSeed> lessons,
                      List<QuestionSeed> quiz) {
        CourseSeed(String sectionId, String title, String description, boolean locked, List<LessonSeed> lessons) {
            this(sectionId, title, description, locked, lessons, List.of());
        }
    }

    static final String AUTHOR = "Time LURE";

    static final List<SectionSeed> SECTIONS = List.of(
            new SectionSeed("intro", "INTRODUÇÃO", "Comece por aqui — a base do ecossistema LURE"),
            new SectionSeed("social", "SOCIAL SELLING", "Prospecção e autoridade nas redes"),
            new SectionSeed("call", "CALL DE VENDAS", "Do primeiro contato ao fechamento"),
            new SectionSeed("rh", "RH & CULTURA", "Time forte, cultura forte, resultado forte"),
            new SectionSeed("comercial", "COMERCIAL", "Processos, funil e conversão de alto ticket"),
            new SectionSeed("marketing", "MARKETING", "Estratégia, marca e posicionamento"),
            new SectionSeed("trafego", "GESTÃO DE TRÁFEGO", "Meta, Google e mensuração em escala"),
            new SectionSeed("ia", "IA APLICADA", "Inteligência artificial no dia a dia de marketing"),
            new SectionSeed("conteudo", "CONTEÚDO & CRIATIVOS", "Narrativa, roteiro e produção que converte"));

    static final List<CourseSeed> COURSES = List.of(
            // ---------------------------------------------------------------- intro
            new CourseSeed("intro", "Boas-vindas ao AssessoriaLure",
                    "Conheça o ecossistema LURE, como a jornada está organizada e o que esperar de cada trilha.",
                    false,
                    List.of(
                            new LessonSeed("Seja bem-vindo(a) à LURE",
                                    "Uma mensagem do time e a visão por trás do programa."),
                            new LessonSeed("Como a jornada está organizada",
                                    "Seções, módulos, aulas, provas e certificados: o mapa completo da plataforma."),
                            new LessonSeed("Sua meta para os próximos 90 dias",
                                    "Um exercício rápido para você sair daqui com um objetivo claro e mensurável.")),
                    List.of(
                            new QuestionSeed("Onde você acompanha o seu progresso e os módulos em andamento?",
                                    List.of("Na página Meus cursos", "Somente no e-mail semanal",
                                            "Na comunidade", "Não é possível acompanhar"), 0),
                            new QuestionSeed("O que é necessário para receber o certificado de um módulo?",
                                    List.of("Assistir apenas à primeira aula",
                                            "Concluir todas as aulas e ser aprovado na prova final (quando houver)",
                                            "Publicar na comunidade", "Pedir ao administrador"), 1),
                            new QuestionSeed("Qual é a nota mínima para aprovação na prova final?",
                                    List.of("50%", "60%", "70%", "100%"), 2))),
            new CourseSeed("intro", "Como estudar na plataforma",
                    "Dicas práticas para aproveitar a área de membros: aulas, materiais, comunidade e diagnóstico.",
                    false,
                    List.of(
                            new LessonSeed("Navegando pela área de membros",
                                    "Catálogo, busca, continuar assistindo e notificações."),
                            new LessonSeed("Materiais, anotações e certificados",
                                    "Onde baixar os materiais de apoio e como emitir seus certificados."),
                            new LessonSeed("Comunidade: como tirar o máximo",
                                    "Categorias, boas práticas e como pedir ajuda para outros membros."),
                            new LessonSeed("Diagnóstico de maturidade: por onde começar",
                                    "Use o diagnóstico para descobrir quais trilhas priorizar."))),

            // ---------------------------------------------------------------- social
            new CourseSeed("social", "Fundamentos do Social Selling",
                    "Como usar as redes sociais para gerar oportunidades de negócio sem parecer vendedor chato.",
                    false,
                    List.of(
                            new LessonSeed("O que é Social Selling (e o que não é)",
                                    "Conceitos, mitos e por que relacionamento vem antes da venda."),
                            new LessonSeed("Perfil que vende: LinkedIn e Instagram",
                                    "Otimize foto, headline, bio e destaques para atrair o cliente certo."),
                            new LessonSeed("Mapeando o seu cliente ideal nas redes",
                                    "Onde o seu ICP está, o que consome e como encontrá-lo."),
                            new LessonSeed("Rotina diária de prospecção",
                                    "Um roteiro de 30 minutos por dia para gerar conversas qualificadas."))),
            new CourseSeed("social", "Conteúdo que gera autoridade",
                    "Transforme conhecimento em conteúdo que abre portas e encurta o ciclo de vendas.",
                    false,
                    List.of(
                            new LessonSeed("Pilares de conteúdo para vendas consultivas",
                                    "Educação, prova social, bastidores e opinião: o equilíbrio certo."),
                            new LessonSeed("Formatos que geram conversa",
                                    "Carrosséis, vídeos curtos e textos que convidam à interação."),
                            new LessonSeed("Do comentário ao direct",
                                    "Abordagens naturais para transformar engajamento em reunião."))),

            // ---------------------------------------------------------------- call
            new CourseSeed("call", "Estrutura de uma call de vendas",
                    "O passo a passo de uma call consultiva, da preparação ao próximo passo combinado.",
                    false,
                    List.of(
                            new LessonSeed("Preparação: pesquisa e objetivo da call",
                                    "O que levantar antes da reunião e como definir o resultado esperado."),
                            new LessonSeed("Abertura e rapport nos primeiros 5 minutos",
                                    "Como conduzir o início da conversa e alinhar a agenda."),
                            new LessonSeed("Diagnóstico com perguntas SPIN",
                                    "Situação, problema, implicação e necessidade na prática."),
                            new LessonSeed("Apresentação da solução orientada à dor",
                                    "Conecte cada funcionalidade a um problema real do cliente."),
                            new LessonSeed("Próximos passos e compromisso",
                                    "Encerre a call com data, responsável e decisão clara."))),
            new CourseSeed("call", "Objeções e fechamento",
                    "Técnicas para lidar com objeções com segurança e fechar sem pressão.",
                    false,
                    List.of(
                            new LessonSeed("As 6 objeções mais comuns",
                                    "Preço, prazo, confiança, concorrência, timing e autoridade."),
                            new LessonSeed("Isolando a objeção verdadeira",
                                    "Perguntas para descobrir o que realmente impede a decisão."),
                            new LessonSeed("Fechamento sem pressão",
                                    "Técnicas de fechamento consultivo para vendas de alto ticket."),
                            new LessonSeed("Follow-up que não incomoda",
                                    "Cadência e mensagens que mantêm a negociação viva."))),

            // ---------------------------------------------------------------- rh
            new CourseSeed("rh", "Cultura como vantagem competitiva",
                    "Como construir e sustentar uma cultura que atrai, engaja e retém as pessoas certas.",
                    false,
                    List.of(
                            new LessonSeed("Missão, visão e valores na prática",
                                    "Do quadro na parede às decisões do dia a dia."),
                            new LessonSeed("Rituais que sustentam a cultura",
                                    "Reuniões, celebrações e comunicação interna com propósito."),
                            new LessonSeed("Feedback contínuo e 1:1s",
                                    "Estrutura de conversas individuais que desenvolvem o time."))),
            new CourseSeed("rh", "Contratação e onboarding de talentos",
                    "Processo seletivo estruturado e um onboarding que acelera a produtividade.",
                    false,
                    List.of(
                            new LessonSeed("Perfil de vaga e scorecard",
                                    "Defina resultados esperados e competências antes de abrir a vaga."),
                            new LessonSeed("Entrevistas estruturadas",
                                    "Perguntas comportamentais e critérios objetivos de avaliação."),
                            new LessonSeed("Onboarding dos primeiros 30 dias",
                                    "Checklist para integrar novas pessoas com clareza e acolhimento."),
                            new LessonSeed("Retenção e plano de carreira",
                                    "Trilhas de crescimento e sinais de alerta de turnover."))),

            // ---------------------------------------------------------------- comercial
            new CourseSeed("comercial", "Funil comercial de alto ticket",
                    "Desenhe e opere um funil previsível para vendas complexas e de alto valor.",
                    false,
                    List.of(
                            new LessonSeed("Desenhando as etapas do funil",
                                    "Critérios de entrada e saída para cada etapa do pipeline."),
                            new LessonSeed("Qualificação: BANT e além",
                                    "Frameworks para priorizar as oportunidades certas."),
                            new LessonSeed("Cadências de contato",
                                    "Sequências multicanal para prospecção e nutrição."),
                            new LessonSeed("Métricas do funil",
                                    "Taxas de conversão, ciclo de vendas e ticket médio."))),
            new CourseSeed("comercial", "Processos e CRM na prática",
                    "Organize o time comercial com playbook, CRM e rituais de gestão.",
                    false,
                    List.of(
                            new LessonSeed("Escolhendo e configurando o CRM",
                                    "Campos, etapas e automações essenciais."),
                            new LessonSeed("Playbook comercial",
                                    "Documente o que funciona para escalar o time."),
                            new LessonSeed("Forecast e reuniões de pipeline",
                                    "Previsibilidade de receita com rituais semanais."))),

            // ---------------------------------------------------------------- marketing
            new CourseSeed("marketing", "Posicionamento e marca",
                    "Construa uma marca clara, memorável e difícil de copiar.",
                    false,
                    List.of(
                            new LessonSeed("Proposta de valor em uma frase",
                                    "Um exercício para comunicar o seu diferencial com clareza."),
                            new LessonSeed("Persona e jornada de compra",
                                    "Entenda quem compra, por que compra e como decide."),
                            new LessonSeed("Identidade verbal e visual",
                                    "Tom de voz, linguagem e elementos visuais consistentes."),
                            new LessonSeed("Diferenciação frente à concorrência",
                                    "Mapa competitivo e espaços de posicionamento livres."))),
            new CourseSeed("marketing", "Planejamento de marketing",
                    "Transforme metas de receita em um plano de marketing executável.",
                    false,
                    List.of(
                            new LessonSeed("Metas de marketing conectadas à receita",
                                    "Do faturamento desejado ao número de leads necessários."),
                            new LessonSeed("Calendário editorial",
                                    "Planejamento mensal de campanhas e conteúdos."),
                            new LessonSeed("Orçamento e priorização de canais",
                                    "Onde investir primeiro e como medir o retorno."))),

            // ---------------------------------------------------------------- trafego
            new CourseSeed("trafego", "Meta Ads do zero à escala",
                    "Estruture, otimize e escale campanhas no Facebook e Instagram com método.",
                    false,
                    List.of(
                            new LessonSeed("Estrutura de campanhas",
                                    "Campanhas, conjuntos e anúncios: como organizar a conta."),
                            new LessonSeed("Públicos frios, mornos e quentes",
                                    "Segmentação, lookalikes e remarketing."),
                            new LessonSeed("Criativos que performam",
                                    "Ângulos, formatos e testes para reduzir o custo por resultado."),
                            new LessonSeed("Otimização e escala de orçamento",
                                    "Quando e como aumentar o investimento sem perder eficiência."))),
            new CourseSeed("trafego", "Google Ads e mensuração avançada",
                    "Campanhas de pesquisa, Performance Max e rastreamento de conversões com GA4.",
                    true,
                    List.of(
                            new LessonSeed("Pesquisa de palavras-chave",
                                    "Intenção de busca, correspondências e negativação."),
                            new LessonSeed("Pesquisa e Performance Max",
                                    "Quando usar cada tipo de campanha e como estruturá-las."),
                            new LessonSeed("GA4 e rastreamento de conversões",
                                    "Eventos, conversões e atribuição para decisões melhores."))),

            // ---------------------------------------------------------------- ia
            new CourseSeed("ia", "IA no marketing do dia a dia",
                    "Ferramentas e fluxos de inteligência artificial para ganhar tempo e qualidade.",
                    false,
                    List.of(
                            new LessonSeed("Panorama das ferramentas de IA generativa",
                                    "Texto, imagem, vídeo e automação: o que usar em cada caso."),
                            new LessonSeed("Prompts que funcionam",
                                    "Estrutura de prompt, contexto e exemplos práticos."),
                            new LessonSeed("IA para pesquisa de mercado e persona",
                                    "Acelere análises de concorrência e público com IA."),
                            new LessonSeed("Fluxos de automação com IA",
                                    "Conecte ferramentas para eliminar tarefas repetitivas."))),
            new CourseSeed("ia", "Criação de conteúdo com IA",
                    "Produza roteiros, copies e criativos com IA sem perder a identidade da marca.",
                    false,
                    List.of(
                            new LessonSeed("Roteiros e copies com IA",
                                    "Da ideia ao texto final com revisão humana."),
                            new LessonSeed("Imagens e vídeos com IA",
                                    "Ferramentas e cuidados para criativos visuais."),
                            new LessonSeed("Ética, revisão e qualidade",
                                    "Boas práticas para usar IA com responsabilidade."))),

            // ---------------------------------------------------------------- conteudo
            new CourseSeed("conteudo", "Narrativa e roteiro",
                    "Histórias e roteiros que prendem a atenção e levam à ação.",
                    false,
                    List.of(
                            new LessonSeed("Storytelling aplicado a vendas",
                                    "A estrutura de uma boa história e onde usá-la."),
                            new LessonSeed("Roteiro para vídeos curtos",
                                    "Gancho, desenvolvimento e chamada em até 60 segundos."),
                            new LessonSeed("Ganchos: os 3 primeiros segundos",
                                    "Modelos de abertura que seguram a audiência."),
                            new LessonSeed("Chamadas para ação que convertem",
                                    "Como pedir o próximo passo de forma natural."))),
            new CourseSeed("conteudo", "Produção de criativos",
                    "Grave, edite e teste criativos com agilidade e baixo custo.",
                    false,
                    List.of(
                            new LessonSeed("Setup enxuto de gravação",
                                    "Luz, áudio e enquadramento com o que você já tem."),
                            new LessonSeed("Edição ágil para redes sociais",
                                    "Fluxo de edição rápido para manter a frequência."),
                            new LessonSeed("Testes A/B de criativos",
                                    "Como testar variações e ler os resultados."))));
}
