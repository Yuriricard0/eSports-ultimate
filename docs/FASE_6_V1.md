# Fase 6 V1 — competições e temporadas

Escopo vinculante: prompt de 18/11/2026. MOBA com seis ligas regionais de 6/8 equipes, turno único, top 4, semis MD3 e final MD5. CS2 com quatro torneios de 8 equipes, eliminatória simples, MD3 e final configurável. Cada mapa usa o simulador da Fase 5. Sem VALORANT, qualificatórias, divisões inferiores, promoção/rebaixamento, mapas ou outras mecânicas adiadas.

Escolhas V1: inscrição direta da carreira na liga principal regional compatível, substituindo uma vaga sem duplicar organização. No CS2, convite à carreira e seleção dos demais por força/reputação e região/disponibilidade. Nomes fictícios editáveis por padrão, sem novos logos oficiais. Entrada exige cinco titulares válidos. Edições com participantes insuficientes são omitidas com motivo.

- [x] Gerar temporadas, participantes existentes, calendário sem conflitos, classificação e desempates (vitórias, saldo, vitórias entre empatados, ID).
- [x] Simular MD1/MD3/MD5 mapa a mapa, avançar eliminatórias e registrar classificação final.
- [x] Integrar avanço de dias: parar na partida do usuário, simular IA nas datas corretas e preservar salários/treino/recuperação.
- [x] Persistir temporadas, séries, mapas, títulos e premiações; crédito e reputação únicos por edição, backup V7 e próximas temporadas anuais.
- [x] Criar Competições e integrar agenda/tela de simulação, sem alterar a Central aprovada.
- [x] Testar temporada completa MOBA/CS2, conflitos, séries, playoffs, títulos, pagamentos, recarga, próxima temporada e regressões.

Arquitetura: estado de edição e jogos em JSON na temporada, com IDs estáveis por edição/confronto e resultados individuais dos mapas. Tabela de premiações com chave única por edição assegura crédito único no caixa existente da carreira; títulos/reputação rivais derivados do mesmo registro. Configuração por carreira vale para próximas edições. Histórico preservado ao iniciar o ano seguinte.

## Resultado

Competições disponível no menu: ligas MOBA, quatro torneios CS2, classificação, calendário, participantes, playoffs/chaves, classificação final e títulos. A Agenda mostra os próximos confrontos da carreira. Abrir confronto usa a tela de Partidas, com cada mapa/jogo da série consultável pelo respectivo botão. A Central da Carreira foi preservada.

O avanço solicitado de 1/7/30 dias pode parar antes para chegar à partida do usuário; enquanto houver confronto próprio pendente, é necessário disputá-lo antes de avançar novamente. Jogos da IA são processados na data correta, com desenvolvimento, recuperação e condições respeitando a ordem cronológica. Não há criação de atletas para completar eventos.

Próxima temporada somente após concluir todas as edições; novos calendários começam no ano seguinte, preservando a data atual da carreira e todos os resultados antigos. Premiação creditada uma vez por edição; prestígio gera reputação para a seleção futura e negociações, sem aumentar habilidades ou Overall por título.

## Validação

73 testes aprovados na suíte completa. Temporadas reais completas de MOBA e CS2 foram executadas pelos comandos do Worker com SQLite nativo em arquivo temporário, incluindo todos os jogos, classificação final, títulos da carreira, contabilidade do prêmio menos folha salarial, rejeição de replays, recarga física, segunda temporada e backup V7. Os testes de calendário cobrem conflitos; os de desempate verificam confronto direto antes de ID; MD3/MD5 preservam os mapas individuais.

TypeScript e compilação de produção aprovados. Revisão independente sem bugs importantes confirmados. Validação visual e OPFS real no navegador permanecem pendentes porque o acesso local havia sido recusado na conversa; esses testes não foram declarados realizados.
