# Ultimate eSports Manager — execução web

Autorização: 16/11/2026, migração das fases 1–3 e início da implementação.
Fonte: prompt mestre anexado e auditoria do Godot nesta conversa.

## Arquitetura
React/TypeScript/Vite para interface. Motor puro separado. SQLite em Worker, persistência local transacional e backups exportáveis; validar OPFS antes de fixar o adaptador. Sem backend obrigatório. Godot e saves originais preservados.

## Plano executável por entregas
- [ ] Fundação: package.json, src/game-core/attributes.ts, tests/attributes.test.ts. Portar os 20 atributos e especialidades de cada função. Testar cálculo 64,57142857 para Top com mecânica 100 e demais 60, funções inválidas, ausência e NaN; observar falha e depois aprovação.
- [ ] Persistência: src/persistence/worker.ts e repository.ts; API create/load/save/export/import. Testar reabertura, rollback, saves inválidos, colisão de IDs, quota e duas abas. Migração em cópia das versões 9/13/15, preservando identidades e centavos.
- [ ] Carreira: src/features/career; cinco passos, capitais 500000/250000/125000/75000, 54 símbolos existentes e identidade editável. Testar criação e restauração.
- [ ] Mundo: src/game-data e src/game-core/world; importar catálogo de 556 organizações, 602 equipes e 218 logos, documentar 338 faltantes. Portar gerador com versão/seed explícitas; nunca regenerar ao carregar. Testar referências e distribuição.
- [ ] Gestão: dashboard, jogadores, perfil, organizações, elenco e comparação. Consultas paginadas e estado derivado da carreira. Testar navegação e resoluções 1280x720 até 2560x1440.
- [ ] Dinâmica: moral, forma, fadiga, entrosamento, evolução, relacionamentos, ranked e renovação. Eventos idempotentes e calendário único. Testar múltiplas temporadas e seeds.
- [ ] Fase 3 web: contratos, propostas, agentes/preferências, valores de mercado, negociações, finanças, IA, empréstimos, pré-contratos, cláusulas, planejamento e notificações. Detalhes em PHASE_3_WEB.md.
- [ ] Estabilização: testes unitários, integração, navegador, offline, desempenho; revisão independente e publicação após funcionalidade validada.

## Riscos e revisão
Saves anteriores à geração; dinheiro em unidades diferentes; RNG Godot incompatível com Math.random; retratos procedurais precisam manter aparência; equipes rivais com vínculo sem contrato. Criar fixtures comparativas e não supor paridade só pela mesma seed.

## Progresso
Auditoria concluída. Pasta web inicialmente vazia e sem Git. Implementação local autorizada; sem alterações no projeto Godot.

Primeiro fluxo em navegador validado em 17/11/2026. A carreira é criada em cinco etapas e reaberta no SQLite local. O catálogo web v1 foi extraído somente do banco demonstrativo do Godot, com 5.014 atletas fictícios e 800 agentes livres. O catálogo inicial é compartilhado entre carreiras, enquanto escalações, contratos e caixa ficam separados por carreira. A geração por seed ainda está pendente.

Jogadores, elenco e mercado de livres estão acessíveis no menu da carreira. A contratação usa os valores de luvas e salário do original. O débito das luvas, a vaga no elenco e o contrato são gravados juntos. O navegador confirmou a reabertura do atleta contratado e a exibição da logo de Bilibili Gaming. Ainda faltam importação de saves, editor completo, simulação do calendário e mercado avançado.

A revisão de interface trouxe as artes MOBA e FPS do executável, os fundos da carreira e os 54 símbolos. Carreiras novas aceitam sigla de até três letras. Os perfis exibem atributos e a faixa estimada de potencial do catálogo demonstrativo.

| Fase | Estado na web | Próximas entregas |
|---|---|---|
| 1 | Criação, editor de identidade, saves locais, renomeação, exclusão, exportação e restauração web, importação da organização Godot e pacote offline | Migração de elenco, contratos e histórico do Godot e validação ponta a ponta no navegador |
| 2 | Catálogo, consulta, Overall, retratos masculinos do Godot, comparação e escalação inicial na contratação | Geração por carreira, moral, forma, entrosamento, progressão e históricos |
| 3 | Agentes livres, luvas e contrato persistido | Calendário contratual, folha, propostas, transferências, renovações, empréstimos e IA |
| 4–6 | Planejamento | Scouting e treino, partidas e competições |
| 7–9 | Planejamento | Economia e instalações, mundo dinâmico, polimento e lançamento |

A Central web agora segue a composição do executável, incluindo a arena e os cinco cartões de titulares. A seção de calendário ainda mostra apenas o estado sem eventos. Os 5.014 retratos foram exportados diretamente com `player_avatar.gd` em um projeto temporário de renderização. A biblioteca de símbolos abre em Todos e mantém os filtros por categoria. A exclusão tem confirmação e remove os registros de uma única carreira em transação SQLite.

O chat **Planejar Ultimate eSports Manager** confirma a decisão de reproduzir as ligas de LoL e os circuitos de CS2, com academias separadas das equipes principais. Essa decisão substitui a regra anterior de dez equipes por tier. A web agora permite consultar as 31 ligas e circuitos de referência, abrir seus participantes e ver o elenco de cada divisão. Os filtros de modalidade, liga e tier precisam coincidir na mesma equipe. O catálogo histórico de referência não fornece calendário jogável. A inscrição inicial da organização controlada pelo usuário ainda precisa ser portada.

O chat também registra elenco inicial vazio, estreia em divisão de desenvolvimento no MOBA, entrada sem classificação no CS2, Liga Coreana e Liga Chinesa fortes por balanceamento, seis perfis de promessas e 24 perks condicionais. O executável e seus relatórios de teste são referências para esses sistemas. A web ainda precisa dos testes equivalentes antes de considerar cada bloco concluído.

As novas carreiras salvam uma geração própria com seed, versão e os 5.014 atletas. Na primeira versão do gerador, os atributos e as estimativas de potencial variam por carreira. Identidade, retrato e vínculos reais seguem o catálogo-base. Os preços das contratações consultam o mundo persistido. Carreiras que já existiam e importações do Godot mantêm a base anterior. Backups web preservam a geração completa.

O mundo v2 acrescenta quatro personalidades e os 24 perks do catálogo Godot. Saves anteriores recebem esses dados na abertura, sem recalcular os atributos. A ficha usa a estimativa de potencial para mostrar um dos seis perfis de promessa e expõe somente traços conhecidos. Um contrato revela os traços do atleta ao clube. A função de efeitos contextuais tem testes, mas ainda precisa ser chamada pelos sistemas de treino, moral, entrosamento e partidas.

O mundo v3 acrescenta 40 amadores da ranked ao catálogo de cada carreira, separados dos 800 agentes livres. Os perfis mostram condição e histórico de Overall. A cada 30 dias o calendário processa crescimento ou declínio dos atributos na mesma transação que grava a data. A Central mostra moral média e entrosamento calculado a partir da convivência e comunicação dos titulares. No Elenco, um reserva com contrato ativo pode assumir a vaga da sua função.

A cada 15 de março do calendário da carreira entram 40 amadores novos. Amadores a partir dos 22 anos ficam livres, e atletas sem equipe nem contrato ativo se aposentam aos 35 anos. O registro dos aposentados é preservado. A reposição anual dos rivais passou a ser tratada separadamente, conforme a atualização abaixo.

A adaptação a um contrato ativo processa dois marcos do catálogo Godot. Aos 30 dias existe a chance de perder Resistência a Mudanças. Aos 60 existe a chance de ganhar Versátil. A operação grava histórico, respeita incompatibilidades e não repete o marco. Eventos de partidas e treinos ainda dependem dos respectivos sistemas. A simulação automatizada percorreu cinco temporadas com o catálogo completo, verificando IDs, vínculos, atributos e renovação. Ainda faltam reprodução no navegador, balanceamento em mais cenários e as logos originais ausentes.

O mundo v4 inclui uma tela Ranked com classificação, pontos simulados, taxa de vitória e filtros de país, função e modalidade. A geração assegura pelo menos três amadores por origem em cada modalidade: 195 países no recorte da ONU, mais Taiwan, Hong Kong e Kosovo. Saves anteriores recebem somente as vagas que faltam, e o calendário repõe vagas nas viradas de temporada. A autorização para contratar amadores continua reservada ao fluxo de scouting e profissionalização.

O mundo v5 acrescenta estilos calculados dos atributos e afinidade dos titulares baseada em função, comunicação e convivência. A Central mostra os pares e usa a afinidade no entrosamento. As fichas de clube mostram a filosofia simulada por divisão e a força estimada. Ligas e circuitos inclui um ranking da estimativa separado da classificação oficial. A linha do tempo reúne contratos, promoções, evolução e mudanças conhecidas de traços.

A renovação anual já substitui veteranos rivais por jovens disponíveis da mesma modalidade e função. Se não houver substituto, o veterano permanece para preservar a vaga. Essa reposição anual funciona antes de haver negociação ou IA de mercado. O processador de perks cobre contratação, adaptação e regras testadas para eventos de treino e partida. As duas últimas fontes de eventos aguardam seus sistemas de jogo.
