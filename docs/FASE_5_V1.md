# Fase 5 V1 — simulação de partidas

Escopo: prompt fornecido em 18/11/2026. Reutilizar atributos, Overall, cinco titulares, entrosamento, condições e perks. Não adicionar draft, mapas, táticas, economia, animação ou campeonatos.

Sem agenda competitiva existente: amistoso preparado contra uma equipe real da mesma modalidade. Uma partida pendente por carreira; pode ser cancelada. Os elencos são revalidados ao simular, na data atual. Partidas concluídas são imutáveis e têm identidade única. Fase 6 fará calendário e campeonatos.

- [x] Motor puro determinístico com seed: força coletiva (cinco titulares e funções), condição e perks, probabilidade e variação.
- [x] MOBA com eventos, objetivos, duração, vitória e K/D/A derivados dos confrontos. FPS por rounds, vitória em 13, prorrogação simplificada de 12–12 até 16; estatísticas derivadas dos rounds.
- [x] Persistir resultado e estatísticas na mesma transação da atualização moderada de moral/forma/fadiga. Não alterar atributos/Overall. Impedir duplicação e rollback parcial.
- [x] Tela Partidas: adversário, escudos, titulares, simular, eventos, resultado, MVP e histórico. Pequeno acesso na Central e no Calendário.
- [x] Backup V6 e recarga; testes MOBA/FPS, placar, estatísticas, forças superiores, surpresas, condições, duplicação, Academy, mercado e treinamento.
- [x] Checkup geral: suíte completa, TypeScript, build e revisão de integração. Informar limites de validação visual/OPFS real.

Decisões: nenhum prêmio financeiro ou ganho de habilidade por resultado. Academia fica fora das partidas principais. IA seleciona por função os cinco melhores atletas disponíveis de seu próprio elenco; nunca utiliza jogadores da carreira. Escalações e nomes são preservados em snapshots do resultado para sobreviver a transferências posteriores.

Resultado: menu Partidas e acessos na Central/Calendário; amistoso preparado com confirmação e revalidação dos titulares; simulação atômica com MVP, K/D/A, eventos e duração. Histórico na própria tela e registro na linha do tempo. Uma partida concluída não aceita repetição. Backup V6 inclui resultados, seeds e estatísticas e segue aceitando versões anteriores.

Validação: testes puros, testes com elencos reais do catálogo e testes executando comandos reais do Worker em SQLite nativo com reabertura do arquivo e restauração. Revisão independente não encontrou problemas importantes de integração. Conferência visual e armazenamento OPFS real do navegador permanecem pendentes; o acesso local havia sido recusado na conversa.
