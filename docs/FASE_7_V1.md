# Fase 7 V1 — finanças e organização

Escopo: prompt de 18/11/2026. Preservar saldo, contratos, folha e premiações existentes; adicionar apenas extrato, patrocinadores fictícios, instalações e limites financeiros básicos da IA.

- [x] Extrato de valores reais: assinaturas/transferências, salários efetivamente pagos, vendas, títulos, patrocínios e instalações. Importar histórico antigo sem modificar saldo e reconciliar saldo inicial + movimentações.
- [x] Até dois patrocinadores ativos; propostas por reputação e ciclo de 30 dias, aceitar/recusar, 180/365 dias, parcelas mensais e última proporcional. Pagamento com chave única e salvamento.
- [x] Centro de treinamento, Academy e scouting com níveis 0–3, custo por melhoria e orçamento. Treino +2% por nível; Academy +2% por nível apenas na base. Scouting sem efeito nesta V1, indicado claramente.
- [x] IA com caixa inicial finito, folha agregada derivada dos atletas existentes, premiações/transferências reais, atrasos registrados e compras/contratações limitadas ao orçamento. Sem segundo sistema de contratos.
- [x] Tela Finanças: resumo por temporada, folha, patrocinadores, instalações, histórico. Central preservada e saldo real.
- [x] Backup V8, recarga e testes de duplicação/rollback, integração com mercado/treinamento/campeonatos e uma temporada completa com patrocínio e despesas.

Decisões: propostas não pagam luvas ao aceitar; primeira parcela vence após 30 dias de vínculo. Não há cancelamento comercial ou negociação complexa. Melhorias usam o saldo disponível e são permanentes; não geram ganho de atributo ao clicar. Atrasos da IA impedem novas contratações e não dispensam automaticamente os elencos. Capital inicial dos rivais é concedido uma vez, sem recargas periódicas. Configuração de reputação continua vindo dos títulos existentes.

Dados anteriores: o extrato recupera os valores efetivamente registrados. Parcelas antigas de salário usam o vencimento como referência porque o esquema anterior não armazenava a data de cada pagamento parcial; isso será identificado na descrição. Nenhum crédito ou débito é repetido nessa recuperação.

## Implementação entregue

Seção Finanças no menu: cards do saldo real/receitas/despesas/resultado, seleção de temporada, folha e atrasos, propostas e contratos de patrocinadores, melhorias permanentes e extrato com até 200 registros recentes do período. Totais consideram todo o período, independentemente da paginação. A Central aprovada foi preservada.

O extrato é um registro dos pagamentos existentes, não uma segunda cobrança. Assinaturas, acertos, parcelas de folha, vendas e premiações mantêm as operações e transações originais. Receitas de patrocínio do avanço são disponibilizadas antes da quitação da folha; parcelas finais são proporcionais. Os contratos de patrocínio ativos não se renovam automaticamente.

Os rivais têm caixa inicial único e finito de pelo menos $100.000 ou seis folhas atuais, pagam folha agregada, registram atrasos e recebem prêmios e valores de transferências. Uma compra ou contratação verifica caixa, folha e atrasos; reposição e renovação anual respeitam o mesmo limite. Não foi criado um segundo sistema de contratos de atletas nem uma economia mundial dinâmica.

## Validação

Testes de finanças cobrem migração sem alterar saldo, patrocínios aceitos/recusados, limite de dois ativos, reputação, parcelas mensais/finais, duplicação, custo/limite das instalações, eficiência pequena e folha paga com receita do mesmo avanço. A integração da Academy verifica o benefício real no treinamento. Uma temporada MOBA completa inclui patrocinador, instalação, folha e título, com saldo reconciliado, reabertura física e backup V8; a temporada CS2 e as fases anteriores seguem na suíte geral.

A checagem adicional encontrou uma colisão de registro ao vender, recontratar e vender um importado no mesmo dia; corrigida com identificação do vínculo e teste de regressão. Revisão independente sem outros problemas importantes confirmados.

Verificação final: 80 testes aprovados na suíte completa, TypeScript sem erros e compilação de produção concluída. Os testes usam bancos temporários e não alteram saves pessoais.

Validação visual e OPFS real no navegador continuam pendentes: a tentativa de abrir localhost foi bloqueada por uma permissão salva. Não foi feita tentativa de contornar esse bloqueio.
