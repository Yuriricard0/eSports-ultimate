# Fase 3 V1 — mercado funcional

Escopo vinculante: prompt V1 fornecido em 18/11/2026. Reutilizar React, SQLite, jogadores, organizações, propostas e folha existentes. Sem recriar telas ou adicionar mecânicas adiadas.

Auditoria: agentes livres, salário, prazo, contraproposta, recusa, assinatura, folha e persistência já existem. Faltam compra de rivais, venda, dispensa, renovação, valor estimado e reposição de rivais.

## Plano de execução

- [x] Testar e completar compra no fluxo de propostas existente. Cotação persistida vincula vendedor e taxa; assinatura revalida disponibilidade e caixa, debita uma vez e repõe o rival.
- [x] Testar e implementar renovação, venda e dispensa. Preservar contratos históricos, liquidar salário proporcional, atualizar titularidade. Renovação altera salário a partir do dia atual sem cobrança retroativa.
- [x] Integrar os comandos nas telas Mercado e Elenco. Exibir modalidade, valor, contrato e histórico de movimentações. Confirmação dentro da tela para saídas.
- [x] Persistir novos registros no backup, restaurar versões anteriores e verificar recarga usando SQLite real. Rodar testes completos, TypeScript e build.

Decisões de implementação: tabelas auxiliares pequenas para encerramentos, faixas salariais, cotações e movimentações; estruturas existentes preservadas. IA apenas preenche funções faltantes usando livres disponíveis e aceita vendas coerentes com reputação e Overall. Não há mercado autônomo sofisticado. Não alterar saves pessoais nem o projeto Godot.

Casos críticos: proposta antiga após troca de clube; assinatura duplicada; caixa insuficiente; dispensa no dia da contratação; renovação no meio da folha; backups antigos; importados sem contrato; jogador próprio escolhido pela IA. Todos devem manter vínculos e saldo consistentes.

## Validação e limites

Testes de domínio e integração usam SQLite real. O teste de integração executa os comandos do próprio Worker com o armazenamento adaptado para SQLite nativo, compra dois jogadores simultaneamente, reabre o arquivo e verifica renovação, venda, agente livre, cancelamento, dispensa e orçamento. Também há teste de funções nos 602 times do catálogo completo e restauração do backup V4. Isso não substitui validação visual do navegador ou teste do OPFS real.

A revisão encontrou cobrança duplicada em dia de pagamento, sobreposição após renovação no último dia e titularidade indevida ao dispensar reserva importado. Todos receberam testes de regressão. A serialização dos comandos impede sobrescrita de elencos em operações simultâneas.

Uso: Mercado para livres, compras e negociações; Elenco para renovar, receber propostas de compra ou dispensar. Contratos importados ausentes no save original continuam sem inventar condições financeiras: permitem venda e dispensa, e não exibem renovação até haver contrato web. Validação visual permanece pendente; o navegador local teve acesso recusado anteriormente nesta conversa.
