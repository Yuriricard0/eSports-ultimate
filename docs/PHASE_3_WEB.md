# Fase 3 — Mercado e contratos na web

> Plano histórico. Em 18/11/2026, o escopo vigente passou a ser [Fase 3 V1](FASE_3_V1.md). Agentes, empréstimos, cláusulas e demais mecânicas avançadas abaixo ficam adiados.

Adaptação do prompt antigo: Godot/GDScript/Windows passam a React/TypeScript/navegador. SQLite permanece atrás de um repositório, sem dependência de React no motor. Nenhuma regra de Overall é alterada.

## Entidades e operações
Contrato distingue vínculo econômico de inscrição esportiva; empréstimo mantém organização proprietária e equipe de destino. Proposta versionada contém salário, luvas, duração, papel, cláusulas e prazo. Negociação usa estados rascunho, enviada, em análise, contraproposta, aceita, recusada, expirada, cancelada e concluída. Aceita só vira concluída na transação financeira e esportiva.

Agentes e preferências ponderam dinheiro, titularidade, reputação, desenvolvimento e estabilidade. Contrapropostas indicam o termo insuficiente. O usuário e IA só usam informações conhecidas; potencial interno não aparece como preço ou probabilidade exata.

## Transações
Validar revisão da proposta, data, jogador, contrato vigente, orçamento reservado, destino e elegibilidade. Em uma transação registrar contrato, término do vínculo anterior quando aplicável, elenco, escalação, pagamentos, obrigações, histórico e eventos. Falha desfaz tudo. Chaves de operação impedem pagamento duplicado.

Dinheiro em centavos inteiros seguros. Migração converte career.balance uma única vez; salary_cents já está convertido. Saldo disponível desconta compromissos. Organizações rivais precisam receber contratos iniciais coerentes antes de habilitar mercado completo, preservando atletas e vínculos existentes.

## Tempo e IA
Calendário central processa vencimentos, salários, parcelas, retorno de empréstimos, pré-contratos e expiração de propostas. Comando avançarDia registra dia e eventos atomicamente. IA roda em lotes no Worker, seleciona candidatos por função, custo e filosofia; não cria dinheiro nem aceita todas as ofertas.

## Interfaces
Central com pesquisa, propostas, negociações, contratos, empréstimos, planejamento e histórico. Formulário apresenta custo imediato, compromisso futuro, caixa restante e prazo. Notificações vêm dos eventos persistidos. Rumor se distingue de transferência confirmada.

## Ordem e validação
1. Contratos e obrigações: datas, conflitos, saldo, centavos e migração dos rivais.
2. Pesquisa e propostas: filtros, estados válidos e cancelamento/expiração.
3. Agentes e decisões: recusa fundamentada, contraproposta e concorrência.
4. Transferência e finanças: rollback induzido em cada etapa, duplicação, salvar/reabrir.
5. IA: necessidades, orçamento, cadência e diversidade em várias temporadas.
6. Renovação, promessas e insatisfação: evidência antes de penalidade.
7. Empréstimos, pré-contratos, rescisão e cláusulas: datas, retorno e ausência de duplicação.
8. Planejamento, adaptação, relações institucionais e notificações.
9. Janelas/elegibilidade configuráveis, UI, balanceamento e desempenho.

Exemplo hipotético de balanceamento: caixa $250.000, luvas $20.000, salário $5.000/mês por 12 meses: caixa imediato $230.000, compromisso salarial $60.000; salário não é taxa de transferência. Valores não definitivos.

Fases 4–9 permanecem no roadmap: scouting/treino, partidas, competições, economia completa, mundo dinâmico e lançamento. Não são concluídas pela existência de tabelas ou telas vazias.

## Calendário e folha disponíveis

A Central avança um dia. A tela Calendário permite avançar 1, 7 ou 30 dias e mostra a folha com valores vencidos, pagos e em aberto. O salário usa períodos fixos de 30 dias de contrato e parcela final proporcional. Vencimentos devolvem o atleta ao mercado de livres e liberam a vaga. O reserva ativo mais antigo da mesma função assume a titularidade, se houver.

Se o saldo acabar, o restante permanece em aberto e impede novas contratações. A folha é processada por vencimento e pode ser quitada em avanços futuros quando houver caixa. Receitas recorrentes ainda não foram implementadas. O esquema web v2 preserva contratos e luvas do v1. A importação de saves do Godot permanece separada.

## Negociação de agentes livres

O Mercado permite propor luvas, salário por 30 dias e duração de 180, 365 ou 730 dias. A primeira resposta é imediata e usa os valores de referência e a personalidade. Uma oferta próxima recebe contraproposta. Uma oferta muito baixa é recusada. Aceites e contrapropostas vencem após sete dias e podem ser cancelados. A assinatura confere o caixa, a próxima folha e a existência de vínculo ativo antes de gravar o contrato e debitar as luvas na mesma transação. A negociação vai junto no backup.

Este bloco cobre agentes livres. Agentes como pessoas com perfis próprios, disputa por ofertas, renovação, transferências entre clubes, empréstimos e IA financeira ainda estão pendentes.
