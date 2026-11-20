// Catálogo de scripts/perk_catalog.gd no projeto Godot.
export const perks = [
  {
    "id": "cold_blood",
    "name": "Sangue Frio",
    "kind": "positive",
    "description": "Mantém a execução sob pressão.",
    "trigger": "pressure",
    "metric": "execution",
    "amount": 0.08,
    "conditions": {
      "min_discipline": 55
    }
  },
  {
    "id": "decisive",
    "name": "Decisivo",
    "kind": "positive",
    "description": "Executa melhor em momentos decisivos.",
    "trigger": "decisive",
    "metric": "execution",
    "amount": 0.08,
    "conditions": {
      "min_ambition": 55
    }
  },
  {
    "id": "natural_leader",
    "name": "Líder Nato",
    "kind": "positive",
    "description": "Ajuda a recuperação coletiva após dificuldades.",
    "trigger": "team_recovery",
    "metric": "morale_recovery",
    "amount": 0.12,
    "conditions": {
      "relative_attribute": "leadership",
      "min_relative": -2
    }
  },
  {
    "id": "strategic_mind",
    "name": "Mente Estratégica",
    "kind": "positive",
    "description": "Melhora a tomada de decisão durante preparação tática.",
    "trigger": "planning",
    "metric": "decision",
    "amount": 0.08,
    "conditions": {
      "relative_attribute": "decisions",
      "min_relative": -2
    }
  },
  {
    "id": "consistent",
    "name": "Consistente",
    "kind": "positive",
    "description": "Reduz a variação em séries prolongadas.",
    "trigger": "long_series",
    "metric": "variance",
    "amount": -0.15,
    "conditions": {
      "min_professionalism": 65
    }
  },
  {
    "id": "communicator",
    "name": "Comunicador",
    "kind": "positive",
    "description": "Favorece coordenação nas ações coletivas.",
    "trigger": "teamplay",
    "metric": "coordination",
    "amount": 0.08,
    "conditions": {
      "relative_attribute": "communication",
      "min_relative": -2
    }
  },
  {
    "id": "versatile",
    "name": "Versátil",
    "kind": "positive",
    "description": "Facilita adaptação a uma função diferente.",
    "trigger": "role_change",
    "metric": "adaptation",
    "amount": 0.12,
    "conditions": {
      "relative_attribute": "adaptation",
      "min_relative": -3
    }
  },
  {
    "id": "fast_learner",
    "name": "Aprendiz Rápido",
    "kind": "positive",
    "description": "Aproveita melhor oportunidades de aprendizado.",
    "trigger": "training",
    "metric": "learning",
    "amount": 0.1,
    "conditions": {
      "min_professionalism": 65
    }
  },
  {
    "id": "tilted",
    "name": "Tiltado",
    "kind": "negative",
    "description": "Perde estabilidade após erros sucessivos.",
    "trigger": "mistakes",
    "metric": "execution",
    "amount": -0.1,
    "conditions": {
      "max_discipline": 65,
      "exclude_personality": "methodical"
    }
  },
  {
    "id": "temperamental",
    "name": "Temperamental",
    "kind": "negative",
    "description": "Tem maior dificuldade para recuperar confiança após críticas.",
    "trigger": "criticism",
    "metric": "morale_recovery",
    "amount": -0.12,
    "conditions": {
      "max_discipline": 60,
      "exclude_personality": "methodical"
    }
  },
  {
    "id": "undisciplined",
    "name": "Indisciplinado",
    "kind": "negative",
    "description": "Aproveita menos a rotina de treino.",
    "trigger": "training",
    "metric": "learning",
    "amount": -0.1,
    "conditions": {
      "max_discipline": 55,
      "exclude_personality": "methodical"
    }
  },
  {
    "id": "inconsistent",
    "name": "Inconstante",
    "kind": "negative",
    "description": "Apresenta maior variação em séries longas.",
    "trigger": "long_series",
    "metric": "variance",
    "amount": 0.18,
    "conditions": {
      "max_professionalism": 65
    }
  },
  {
    "id": "individualist",
    "name": "Individualista",
    "kind": "negative",
    "description": "Dificulta coordenação em jogadas coletivas.",
    "trigger": "teamplay",
    "metric": "coordination",
    "amount": -0.08,
    "conditions": {
      "relative_attribute": "communication",
      "max_relative": 2
    }
  },
  {
    "id": "fragile_pressure",
    "name": "Frágil sob Pressão",
    "kind": "negative",
    "description": "Perde qualidade de execução em situações de pressão.",
    "trigger": "pressure",
    "metric": "execution",
    "amount": -0.08,
    "conditions": {
      "max_discipline": 65
    }
  },
  {
    "id": "complacent",
    "name": "Acomodado",
    "kind": "negative",
    "description": "Aproveita menos o treino quando já está satisfeito.",
    "trigger": "comfortable_training",
    "metric": "learning",
    "amount": -0.12,
    "conditions": {
      "max_ambition": 55
    }
  },
  {
    "id": "change_resistant",
    "name": "Resistente a Mudanças",
    "kind": "negative",
    "description": "Tem dificuldade para se adaptar a novas funções.",
    "trigger": "role_change",
    "metric": "adaptation",
    "amount": -0.12,
    "conditions": {
      "relative_attribute": "adaptation",
      "max_relative": 0,
      "exclude_personality": "adaptable"
    }
  },
  {
    "id": "aggressive",
    "name": "Agressivo",
    "kind": "situational",
    "description": "Busca mais risco: cria oportunidades e aumenta a exposição.",
    "trigger": "engagement",
    "metric": "risk",
    "amount": 0.12,
    "conditions": {
      "min_ambition": 55
    }
  },
  {
    "id": "stage_player",
    "name": "Jogador de Palco",
    "kind": "situational",
    "description": "Executa melhor em eventos presenciais com público.",
    "trigger": "stage",
    "metric": "execution",
    "amount": 0.07,
    "conditions": {}
  },
  {
    "id": "rivalry_specialist",
    "name": "Especialista em Clássicos",
    "kind": "situational",
    "description": "Eleva a execução contra rivais institucionais.",
    "trigger": "rivalry",
    "metric": "execution",
    "amount": 0.07,
    "conditions": {
      "min_ambition": 50
    }
  },
  {
    "id": "creative",
    "name": "Criativo",
    "kind": "situational",
    "description": "Amplia opções e variação diante de situações novas.",
    "trigger": "novel_situation",
    "metric": "decision",
    "amount": 0.06,
    "conditions": {}
  },
  {
    "id": "instinctive",
    "name": "Instintivo",
    "kind": "situational",
    "description": "Favorece decisões rápidas, com maior variação.",
    "trigger": "time_pressure",
    "metric": "decision",
    "amount": 0.06,
    "conditions": {}
  },
  {
    "id": "perfectionist",
    "name": "Perfeccionista",
    "kind": "situational",
    "description": "Aproveita o treino com maior custo de desgaste.",
    "trigger": "training",
    "metric": "learning",
    "amount": 0.08,
    "conditions": {
      "min_professionalism": 70
    }
  },
  {
    "id": "hypercompetitive",
    "name": "Competitivo ao Extremo",
    "kind": "situational",
    "description": "Reage bem a desafios, mas sofre mais após derrotas.",
    "trigger": "challenge",
    "metric": "morale_recovery",
    "amount": 0.08,
    "conditions": {
      "min_ambition": 75
    }
  },
  {
    "id": "confidence_dependent",
    "name": "Dependente de Confiança",
    "kind": "situational",
    "description": "Sua execução reage mais à confiança alta ou baixa.",
    "trigger": "confidence_extreme",
    "metric": "execution",
    "amount": 0.08,
    "conditions": {}
  }
];
export const incompatible = [["cold_blood","fragile_pressure"],["cold_blood","tilted"],["consistent","inconsistent"],["communicator","individualist"],["versatile","change_resistant"],["fast_learner","complacent"]];
