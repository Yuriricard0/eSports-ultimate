# Fase 8 V1 — notícias e acontecimentos

Escopo do prompt de 18/11/2026. Notícias curtas sobre fatos registrados: contratos, transferências, dispensas, término de vínculo, renovações, resultados relevantes, campeões, instalações e evolução pública. Não inventar negociações ou resultados.

- [x] Projetar notícias a partir dos registros existentes, com chave estável por acontecimento e ordem por data/publicação; recuperar fatos antigos sem duplicar após recarga/backup.
- [x] Disponibilidade e perfil de jogador sempre consultam o vínculo atual, enquanto o texto da notícia permanece histórico.
- [x] Reaproveitar o painel da Central para uma única seção Notícias e Atualizações com três notícias. Página Notícias com filtros/paginação e links aos perfis/séries existentes.
- [x] Evento raro de moral ±3: verificação semanal, chance determinística de 15%, intervalo mínimo de 30 dias na organização, apenas atleta ativo; efeito e histórico na mesma transação do avanço.
- [x] Registrar melhorias reais de treino sem conceder habilidade extra, novas promessas públicas da ranked após renovação anual (até três destaques, estimativa pública mínima 85), títulos e alterações existentes de reputação. Não criar um segundo indicador.
- [x] Backup V9, testes de verdade dos fatos, estado atual, ordenação, três itens na Central, eventos equilibrados/idempotentes, persistência e regressões.

Estrutura: notícias com dados relacionados em JSON e índices de carreira/data; marcadores de evolução; tabela dos eventos de moral aplicados. O painel Notícias substitui o conteúdo estático da antiga Caixa de entrada na mesma posição da Central, sem criar uma segunda seção ou reorganizar o layout.

Sem redes sociais, entrevistas, decisões narrativas, lesões, suspensões, escândalos ou sistemas de mundo adicionais. As notícias registram os acontecimentos dos sistemas existentes. Perfil mostra a organização atual, evitando anunciar como livre um atleta já contratado.

## Resultado e validação

Menu Notícias com quatro categorias, busca, paginação, datas e resumos. A Central mostra os três itens mais recentes na seção única. Escudos e retratos vêm dos dados atuais; perfis abrem o atleta existente e resultados abrem a série histórica correta. Disponibilidade é um indicador atual, separado do relato histórico de dispensa/contratação.

Notícias são projeções idempotentes dos registros oficiais da carreira. A origem de uma transferência usa o recibo da operação realmente concluída, evitando reutilizar um vendedor de proposta antiga. Eventos de moral e marcadores de desenvolvimento são registrados no avanço de dias, na mesma transação dos efeitos. Notícias de evolução apenas descrevem ganhos já realizados; não concedem atributos ou reputação adicionais. Backup V9 preserva notícias, ordem de publicação, marcadores e efeitos aplicados, e aceita versões anteriores.

86 testes aprovados na suíte completa. Os testes incluem compra, dispensa, recontratação e disponibilidade atual, notícia sem fatos inexistentes, filtro/ordenação/limite de três, moral equilibrada e idempotente, evolução real, reabertura física do banco e cópia do backup. Temporadas completas de MOBA e CS2 validam campeões, resultados relacionados, notícias persistentes e histórico copiado sem duplicação.

A revisão identificou uma seleção de perfil que guardava um objeto antigo após venda no elenco. Corrigido para guardar o ID e consultar os dados atuais. TypeScript aprovado; compilação de produção verificada. Os testes usam SQLite nativo em arquivos temporários, preservando saves pessoais e o projeto Godot. Validação visual e OPFS real continuam pendentes porque o navegador bloqueia o acesso local por uma permissão salva.
