/** Pilares do diagnóstico de maturidade (cópia de backend/src/main/resources/diagnostic/pillars.json). */

export interface PillarOption {
  score: number;
  label: string;
  text: string;
}

export interface PillarQuestion {
  id: string;
  text: string;
  options: PillarOption[];
}

export interface Pillar {
  id: string;
  name: string;
  actions: string[];
  recommendedSections: string[];
  questions: PillarQuestion[];
}

export const PILLARS: readonly Pillar[] = [
  {
    "id": "gestao",
    "name": "Gestão e Estratégia",
    "actions": [
      "Documente a visão de 3 anos e desdobre em OKRs trimestrais com rituais semanais.",
      "Implante DRE mensal + previsão orçamentária de 12 meses.",
      "Crie playbooks dos 5 processos mais críticos e revise a cada 90 dias.",
      "Monte um dashboard executivo com no máximo 8 KPIs de decisão."
    ],
    "recommendedSections": [
      "trilha-lideranca",
      "trilha-processos"
    ],
    "questions": [
      {
        "id": "1.1",
        "text": "Qual é o nível de clareza e formalização da visão e da estratégia de longo prazo da empresa?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Não há metas de longo prazo definidas."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Metas informais, sem documentação clara."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Planejamento estratégico anual documentado, mas pouco revisado."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Planejamento estratégico claro, desdobrado em OKRs/metas mensais."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Visão inspiradora desdobrada para todos os níveis, integrada ao dia a dia."
          }
        ]
      },
      {
        "id": "1.2",
        "text": "Como é realizada a definição e o acompanhamento das metas individuais e de times?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Não há metas claras individuais ou de times."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Há metas verbais sem rotina de acompanhamento estruturada."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Metas definidas anualmente ou semestralmente, com análises ocasionais."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "OKRs ou metas trimestrais revisadas com rituais mensais ou semanais."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Sistema de metas conectado ao painel de KPIs atualizado em tempo real."
          }
        ]
      },
      {
        "id": "1.3",
        "text": "Quão estruturada é a definição de processos e fluxos operacionais?",
        "options": [
          {
            "score": 1,
            "label": "Improvisado",
            "text": "Sem documentação, processos variam a cada execução."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Alguns processos críticos estão registrados no papel ou chats."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Manuais de processos existem, mas estão desatualizados."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Processos mapeados, documentados (Playbooks) e seguidos pela equipe."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Processos padronizados e continuamente otimizados com dados e automações."
          }
        ]
      },
      {
        "id": "1.4",
        "text": "Como você avalia o controle e a previsibilidade financeira da empresa?",
        "options": [
          {
            "score": 1,
            "label": "Improvisado",
            "text": "Sem visibilidade clara de caixa ou faturamento previsível."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Apenas fluxo de caixa básico do mês corrente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "DRE mensal atualizado, mas sem projeções de longo prazo."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Previsão orçamentária anual e controle rígido de margem."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Dashboard financeiro em tempo real conectado a cenários e projeções."
          }
        ]
      },
      {
        "id": "1.5",
        "text": "Como são tomadas as decisões estratégicas dentro do negócio?",
        "options": [
          {
            "score": 1,
            "label": "Empírico",
            "text": "Decisões baseadas exclusivamente no feeling dos sócios."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Focadas em histórico simples e dados superficiais de faturamento."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Baseadas em relatórios mensais gerados com atraso."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Análise sistemática de dados de mercado e KPIs internos."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Decisões orientadas por dados em tempo real e experimentos."
          }
        ]
      },
      {
        "id": "1.6",
        "text": "Qual é o nível de autonomia da empresa sem a presença direta dos fundadores?",
        "options": [
          {
            "score": 1,
            "label": "Dependência total",
            "text": "A empresa para de operar se os fundadores se ausentarem por dias."
          },
          {
            "score": 2,
            "label": "Dependência alta",
            "text": "Equipe executa tarefas básicas, mas decisões travam."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Operação roda, mas problemas médios exigem presença direta."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Empresa roda estável por semanas sem intervenção dos sócios."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Totalmente autônoma, com governança e gestão profissionalizada."
          }
        ]
      },
      {
        "id": "1.7",
        "text": "Como a empresa monitora e responde à concorrência e mudanças de mercado?",
        "options": [
          {
            "score": 1,
            "label": "Reativo",
            "text": "Só respondemos quando perdemos clientes significativos."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Monitoramos esporadicamente o posicionamento dos rivais."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Análise anual das tendências e posicionamento competitivo."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Rotina mensal de análise competitiva e adaptação."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Antecipamos tendências, testando soluções à frente do setor."
          }
        ]
      }
    ]
  },
  {
    "id": "cultura",
    "name": "Cultura e Liderança",
    "actions": [
      "Formalize valores e integre-os no processo de contratação, feedback e demissão.",
      "Implemente 1-on-1s mensais estruturados entre líderes e liderados.",
      "Crie um onboarding de 30 dias com metas de ativação por cargo.",
      "Rode e-NPS trimestral com plano de ação por área."
    ],
    "recommendedSections": [
      "trilha-lideranca"
    ],
    "questions": [
      {
        "id": "2.1",
        "text": "Como está definida a estrutura organizacional e responsabilidades das funções?",
        "options": [
          {
            "score": 1,
            "label": "Confusa",
            "text": "Todos fazem um pouco de tudo sem clareza de papéis."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Divisão informal com frequente sobreposição."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Organograma básico, responsabilidades não documentadas."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Organograma claro com descritivo de funções e metas."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Estrutura fluida com papéis desenhados e caminhos de carreira."
          }
        ]
      },
      {
        "id": "2.2",
        "text": "Como são definidos e vivenciados os valores e a cultura da empresa?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Sem valores formalizados, foco no dia a dia técnico."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Valores no site ou parede, sem vivência real."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Liderança busca seguir os valores informalmente."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Valores guiam contratações, demissões e avaliações."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Cultura forte funciona como diferencial competitivo."
          }
        ]
      },
      {
        "id": "2.3",
        "text": "Qual é a qualidade e a frequência das rotinas de feedback?",
        "options": [
          {
            "score": 1,
            "label": "Nulo",
            "text": "Feedback só ocorre em demissão ou problemas graves."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Feedbacks rápidos de corredor, sem registro."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Avaliações anuais com feedbacks pontuais."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Rituais mensais de 1-on-1 com planos de ação."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Feedback contínuo integrado ao desenvolvimento acelerado."
          }
        ]
      },
      {
        "id": "2.4",
        "text": "Como é o processo de atração e recrutamento de novos talentos?",
        "options": [
          {
            "score": 1,
            "label": "Improvisado",
            "text": "Contratações rápidas por indicação ou urgência."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Triagem simples e entrevista técnica com os sócios."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Processo estruturado por perfil técnico, sem fit cultural."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Teste técnico, fit cultural e múltiplos avaliadores."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Employer Branding forte e funil de alta conversão."
          }
        ]
      },
      {
        "id": "2.5",
        "text": "Como é estruturada a integração (Onboarding) de novos colaboradores?",
        "options": [
          {
            "score": 1,
            "label": "Ausente",
            "text": "O novo funcionário senta e começa a trabalhar."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Apresentação rápida da equipe e acessos iniciais."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Agenda de conversas e leitura de playbooks na 1ª semana."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Programa de 30 dias com metas, mentor e testes."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Experiência marcante focada em cultura, técnica e produtividade."
          }
        ]
      },
      {
        "id": "2.6",
        "text": "Qual é o foco da liderança no desenvolvimento de novos líderes?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Os fundadores centralizam todas as lideranças."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Promoção por tempo de casa, sem treinamento específico."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Capacitações pontuais ou cursos externos."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Plano de desenvolvimento individualizado para gestores."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Pipeline de liderança com plano de sucessão estruturado."
          }
        ]
      },
      {
        "id": "2.7",
        "text": "Como é monitorado o clima organizacional e a satisfação do time?",
        "options": [
          {
            "score": 1,
            "label": "Sem monitoramento",
            "text": "Só sabemos quando alguém pede demissão."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Conversas informais ocasionais."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Pesquisa anual de clima simples."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "e-NPS trimestral com planos de ação."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Pulso quinzenal com planos ágeis de retenção."
          }
        ]
      }
    ]
  },
  {
    "id": "marketing",
    "name": "Marketing e Demanda",
    "actions": [
      "Redefina o ICP com dores, gatilhos e canais preferidos — documente em 1 página.",
      "Monte um funil mensurável (visitante → lead → MQL → SQL → cliente).",
      "Escale tráfego pago com metas de CAC e LTV por canal.",
      "Construa autoridade com uma máquina de conteúdo semanal alinhada ao funil."
    ],
    "recommendedSections": [],
    "questions": [
      {
        "id": "3.1",
        "text": "Qual é o nível de conhecimento sobre o Perfil de Cliente Ideal (ICP)?",
        "options": [
          {
            "score": 1,
            "label": "Superficial",
            "text": "Atendemos qualquer perfil disposto a pagar."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Sabemos informações demográficas genéricas."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Personas mapeadas, mas não guiam o marketing."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "ICP documentado com dores, comportamentos e histórico."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "ICP hiper-segmentado integrado à qualificação de leads."
          }
        ]
      },
      {
        "id": "3.2",
        "text": "Como é estruturada a aquisição por canais pagos (Tráfego Pago)?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Sem campanhas ou impulsionamentos aleatórios."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Campanhas no ar sem otimização constante."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "ROI positivo, mas dificuldade de escalar."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Estratégia multicanal com metas de CAC e LTV."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Gestão científica de tráfego com automação e remarketing."
          }
        ]
      },
      {
        "id": "3.3",
        "text": "Como é gerido o funil de Inbound Marketing e produção de conteúdo?",
        "options": [
          {
            "score": 1,
            "label": "Sem funil",
            "text": "Publicações esporádicas sem estratégia comercial."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Redes ativas com conteúdo de topo genérico."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Foco em conversão básica (iscas, e-books)."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Jornada completa automatizada no RD Station ou similar."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Máquina de autoridade gerando leads previsivelmente."
          }
        ]
      },
      {
        "id": "3.4",
        "text": "Como a empresa monitora a taxa de conversão em cada etapa do funil?",
        "options": [
          {
            "score": 1,
            "label": "Não monitora",
            "text": "Só sabemos o faturamento final do mês."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Monitoramos cliques e volume de mensagens."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Visitante → lead mapeada com ferramentas simples."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Taxas detalhadas por etapa (MQL, SQL, Oportunidade)."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Funil integrado com atribuição avançada em tempo real."
          }
        ]
      },
      {
        "id": "3.5",
        "text": "Como está estruturada a sua proposta de valor única?",
        "options": [
          {
            "score": 1,
            "label": "Indiferenciada",
            "text": "Mesmo produto/preço dos concorrentes."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Argumentos de 'qualidade' e 'atendimento'."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Diferenciais claros, difícil transmitir."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Proposta clara em toda a comunicação e pitch."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Categoria própria, permitindo cobrar premium."
          }
        ]
      },
      {
        "id": "3.6",
        "text": "Quão estruturadas são as estratégias de Outbound (prospecção ativa)?",
        "options": [
          {
            "score": 1,
            "label": "Ausente",
            "text": "Não realizamos prospecção ativa."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Vendedores buscam contatos ocasionalmente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Lista fria com envios de e-mails em lote."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "SDRs com listas qualificadas e cadência estruturada."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Prospecção de precisão automatizada e integrada ao CRM."
          }
        ]
      },
      {
        "id": "3.7",
        "text": "Como a marca é percebida e posicionada (Branding)?",
        "options": [
          {
            "score": 1,
            "label": "Sem marca",
            "text": "Somos vistos como uma commodity."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Marca visual simples, sem atratividade extra."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Reconhecida localmente com boa reputação."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Identidade forte, geradora orgânica de atração."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Lovebrand com comunidade engajada e advogacia."
          }
        ]
      }
    ]
  },
  {
    "id": "vendas",
    "name": "Vendas e Conversão",
    "actions": [
      "Adote e discipline o uso de um CRM com regras rígidas de movimentação.",
      "Escreva o Playbook Comercial com scripts, objeções e cases.",
      "Rode roleplays semanais e escute gravações do time.",
      "Implemente Lead Scoring e SDR dedicado para qualificação."
    ],
    "recommendedSections": [
      "trilha-vendas",
      "trilha-recuperacao"
    ],
    "questions": [
      {
        "id": "4.1",
        "text": "Qual é o nível de adoção e a qualidade do uso do CRM de Vendas?",
        "options": [
          {
            "score": 1,
            "label": "Nenhum",
            "text": "Controle no WhatsApp, caderno ou planilhas."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Usamos CRM, mas a equipe não atualiza."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "CRM atualizado com pipeline básico."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "CRM integrado ao marketing com automações."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "CRM inteligente com IA prevendo fechamentos."
          }
        ]
      },
      {
        "id": "4.2",
        "text": "Como você avalia os scripts e Playbooks comerciais?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Cada vendedor faz do seu jeito."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Script geral sem mapeamento de objeções."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Documento básico com processos."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Playbook completo com objeções e scripts gravados."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Playbook dinâmico atualizado com práticas do time."
          }
        ]
      },
      {
        "id": "4.3",
        "text": "Como é realizado o treinamento do time de vendas?",
        "options": [
          {
            "score": 1,
            "label": "Nulo",
            "text": "Aprendem no improviso assistindo aos outros."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Explicação teórica no primeiro dia."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Treinamentos pontuais mensais."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Rotina semanal de roleplay e escuta de ligações."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Escola interna com certificação técnica."
          }
        ]
      },
      {
        "id": "4.4",
        "text": "Como funciona a comissão e incentivos para vendas?",
        "options": [
          {
            "score": 1,
            "label": "Fixo",
            "text": "Só salário fixo, sem incentivo."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Comissão simples sobre vendas individuais."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Metas claras com faixas simples de comissão."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Metas aceleradoras (bônus) e coletivas."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Incentivos ligados a LTV, margem e NPS."
          }
        ]
      },
      {
        "id": "4.5",
        "text": "Como é feita a qualificação de leads antes do contato de vendas?",
        "options": [
          {
            "score": 1,
            "label": "Sem qualificação",
            "text": "Contatamos todos que chegam."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Filtro manual com poucas perguntas."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Formulário básico de conversão."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Pré-vendedores dedicados (LDR/SDR)."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Automatizada com Lead Scoring."
          }
        ]
      },
      {
        "id": "4.6",
        "text": "Qual é a previsibilidade do ciclo médio de fechamento?",
        "options": [
          {
            "score": 1,
            "label": "Indeterminado",
            "text": "Não sabemos quanto tempo o lead demora."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Estimativa genérica do tempo de decisão."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Ciclo médio monitorado retroativamente."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Mapeado por perfil com alertas de atraso."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Previsibilidade estatística acurada do pipeline."
          }
        ]
      },
      {
        "id": "4.7",
        "text": "Como é a gestão de propostas de alto valor (Enterprise/High Ticket)?",
        "options": [
          {
            "score": 1,
            "label": "Amadora",
            "text": "Propostas em texto no WhatsApp ou e-mail."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "PDF padronizado alterado manualmente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Slides estruturados com tabelas de preço."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Propostas customizadas com diagnóstico prévio."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Proposta digital com assinatura instantânea e ROI."
          }
        ]
      }
    ]
  },
  {
    "id": "experiencia",
    "name": "Experiência e Clientes",
    "actions": [
      "Construa um onboarding do cliente focado no Primeiro Valor Percebido em ≤30 dias.",
      "Rode NPS transacional contínuo com tratativa obrigatória de detratores.",
      "Crie sinais de alerta de churn e uma rotina proativa de Customer Success.",
      "Estruture programa de indicação com recompensa clara e rastreamento."
    ],
    "recommendedSections": [
      "trilha-fidelizacao"
    ],
    "questions": [
      {
        "id": "5.1",
        "text": "Como é o onboarding do cliente após o fechamento?",
        "options": [
          {
            "score": 1,
            "label": "Desorganizada",
            "text": "Cliente é entregue sem alinhamento prévio."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "E-mail padrão de boas-vindas."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Kick-off só para grandes contas."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Roteiro com metas de ativação de 30 dias."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Jornada automatizada focada em 1º Valor Percebido."
          }
        ]
      },
      {
        "id": "5.2",
        "text": "Constância e método para ouvir o cliente (NPS)?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Só falamos quando há reclamação."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Conversas informais ocasionais."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "NPS anual sem processos definidos."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "NPS contínuo com tratativa de detratores."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Voz do Cliente retroalimenta produto e marketing."
          }
        ]
      },
      {
        "id": "5.3",
        "text": "Como é feita a prevenção ativa de churn?",
        "options": [
          {
            "score": 1,
            "label": "Reativo",
            "text": "Cancelamentos processados quando solicitados."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Ligação tentando desconto no momento da saída."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Análise periódica dos motivos."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Monitoramento de sinais de alerta."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Sistema preditivo com intervenção automatizada."
          }
        ]
      },
      {
        "id": "5.4",
        "text": "Como a empresa estimula upsell e cross-sell?",
        "options": [
          {
            "score": 1,
            "label": "Inexistente",
            "text": "Clientes compram uma vez ou sob demanda."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Avisos esporádicos sobre novos lançamentos."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Upgrades oferecidos perto da renovação."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Jornada estruturada baseada em tempo de uso."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Motor de recomendação gerando receita recorrente."
          }
        ]
      },
      {
        "id": "5.5",
        "text": "Qual é o nível de organização do Suporte ao cliente?",
        "options": [
          {
            "score": 1,
            "label": "Caótico",
            "text": "WhatsApp pessoal de vários atendentes."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "E-mail ou grupo sem controle de prazo."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Chamados simples com SLA básico."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Central integrada com metas de resolução."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Omnicanal hiper-rápido com base dinâmica."
          }
        ]
      },
      {
        "id": "5.6",
        "text": "Como são tratados os clientes promotores?",
        "options": [
          {
            "score": 1,
            "label": "Desperdiçados",
            "text": "Elogios sem ação."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Pedimos indicações informalmente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Programa básico de indique e ganhe."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Programa estruturado com recompensas claras."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Comunidade VIP engajada em cocriação e vendas."
          }
        ]
      },
      {
        "id": "5.7",
        "text": "Velocidade e precisão de resolução técnica (Customer Success)?",
        "options": [
          {
            "score": 1,
            "label": "Lenta",
            "text": "Depende do aval dos diretores."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Operação resolve, sem prazo de garantia."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "SLA estruturado, cumprido esporadicamente."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Equipe com autonomia e orçamento de reparo."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Resolução preventiva antes do cliente perceber."
          }
        ]
      }
    ]
  },
  {
    "id": "ia",
    "name": "Inteligência Artificial",
    "actions": [
      "Publique uma política corporativa de IA (o que pode e o que não pode).",
      "Mapeie 5 processos repetitivos e automatize com IA (Make/n8n + LLM).",
      "Implante RAG sobre a base interna (FAQs, playbooks, contratos).",
      "Treine cada área em prompts específicos da sua função."
    ],
    "recommendedSections": [],
    "questions": [
      {
        "id": "6.1",
        "text": "Como a equipe utiliza IA gerativa (ChatGPT, Claude) no dia a dia?",
        "options": [
          {
            "score": 1,
            "label": "Não utilizam",
            "text": "Ferramentas fora da rotina."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Alguns usam esporadicamente para textos simples."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Uso regular sem diretrizes corporativas."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Uso institucionalizado com diretrizes e segurança."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Equipe capacitada com atalhos e automações personalizadas."
          }
        ]
      },
      {
        "id": "6.2",
        "text": "Nível de automação de tarefas manuais repetitivas com IA?",
        "options": [
          {
            "score": 1,
            "label": "Zero",
            "text": "Processos manuais consomem grande parte do tempo."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Make/Zapier sem IA complexa integrada."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Agentes básicos de IA em triagem pontual."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Workflows com APIs de IA ponta a ponta."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Robôs inteligentes executam fluxos complexos de backoffice."
          }
        ]
      },
      {
        "id": "6.3",
        "text": "Como a IA é usada no atendimento ou triagem inicial de clientes?",
        "options": [
          {
            "score": 1,
            "label": "Ausente",
            "text": "Todo atendimento é humano desde o início."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "URAs numéricas que frustram o cliente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Chatbots simples baseados em regras rígidas."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Assistentes com IA gerativa contextualizada."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Agente autônomo resolvendo chamados complexos."
          }
        ]
      },
      {
        "id": "6.4",
        "text": "Como os dados da empresa alimentam sistemas de IA?",
        "options": [
          {
            "score": 1,
            "label": "Não fazemos",
            "text": "Dados espalhados em PDFs e mensagens."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Copy/paste em ferramentas públicas manualmente."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Base em PDF para consulta de assistentes."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "RAG estruturado com base interna segura."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Fine-tuning de modelos proprietários contínuo."
          }
        ]
      },
      {
        "id": "6.5",
        "text": "Como a IA apoia marketing e redação de anúncios?",
        "options": [
          {
            "score": 1,
            "label": "Nulo",
            "text": "Produção manual do início ao fim."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "IA só para corrigir gramática."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "IA escreve versão inicial dos criativos."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Modelos com voz da marca escrevem anúncios e criam imagens."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Geração em larga escala por público com análise preditiva."
          }
        ]
      },
      {
        "id": "6.6",
        "text": "Como a IA é usada em análise de dados operacionais e financeiros?",
        "options": [
          {
            "score": 1,
            "label": "Não utilizamos",
            "text": "Análise manual em planilhas simples."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Colamos planilhas no ChatGPT pedindo conclusões."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Relatórios mensais com resumos gerados por IA."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Dashboards com IA identificando padrões e anomalias."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Predição de vendas com alocação orçamentária automática."
          }
        ]
      },
      {
        "id": "6.7",
        "text": "Nível de governança, ética e segurança no uso de IA?",
        "options": [
          {
            "score": 1,
            "label": "Ignorado",
            "text": "Sem controle do que a equipe insere."
          },
          {
            "score": 2,
            "label": "Básico",
            "text": "Recomendação genérica de não colocar dados sensíveis."
          },
          {
            "score": 3,
            "label": "Intermediário",
            "text": "Diretiva simples proibindo segredos industriais."
          },
          {
            "score": 4,
            "label": "Avançado",
            "text": "Política rígida com canal oficial (Enterprise API)."
          },
          {
            "score": 5,
            "label": "Líder",
            "text": "Governança completa com auditorias e monitoramento."
          }
        ]
      }
    ]
  }
];

/** Ids de todas as perguntas, na ordem do questionário ("1.1", "1.2", …). */
export const QUESTION_IDS: readonly string[] = PILLARS.flatMap((p) => p.questions.map((q) => q.id));
