# Patch 03 · Mercado da IA

A auditoria encontrou dois fluxos. O botão de venda executava uma consulta que devolvia até 20 cotações por atleta, com ordenação por nome e sem histórico de abordagens. Abrir ou reabrir o painel dava a impressão de que os clubes haviam enviado novas propostas. A IA já preenchia vagas com agentes livres usando saldo e folha salarial. Esse fluxo era distinto das cotações oferecidas ao usuário.

O mercado passa a avaliar abordagens em intervalos de sete dias no calendário. Limites padrão de duas abordagens por clube e atleta em 30 dias, intervalo de 35 dias para a mesma dupla, espera de 60 dias após recusa e vencimento em 14 dias. Os parâmetros ficam em marketLimits. O registro diário e as propostas são gravados na mesma transação do avanço. A leitura da tela não dispara um ciclo de mercado.

A avaliação usa posição, modalidade, situação do elenco, faixa de habilidade observada, participações em séries oficiais e estatísticas recentes. Dados de ranked, idade, equipes Academy e prazo restante de contrato do usuário também influenciam a avaliação. O orçamento considera taxa, salário e folha atual. Não há acesso ao teto oculto de potencial. Transferências da IA exigem cobertura na posição do vendedor. As fórmulas de valor e salário foram mantidas. As novas tabelas são opcionais na restauração de backups anteriores.

## Simulações de balanceamento

Execute node tools/qa-market.ts para reproduzir o teste controlado com o catálogo local, 18 atletas da carreira e as sementes 17, 42 e 2026. Nove desses atletas recebem histórico oficial simulado a partir do dia 31. O cenário usa folha mensal e caixa finito e fixa as cotações da versão anterior como referência. As cotações exibidas pelo sistema anterior não eram propostas efetivamente enviadas. O teste não as contabiliza como transações. O cenário novo contabiliza compras entre IAs quando o vendedor tem cobertura e o comprador dispõe de orçamento.

| Dias | Cotações anteriores por cenário | Abordagens no mundo | Propostas ao usuário | Propostas ao usuário sem histórico | Transferências concluídas entre IAs |
|---|---:|---:|---:|---:|---:|
| 30 | 1.256 | 28–36 | 0–1 | 0–1 | 14–15 |
| 90 | 3.768 | 89–98 | 1–2 | 0–1 | 35–48 |
| 365 | 16.328 | 136–155 | 1–3 | 0–1 | 49–70 |

No dia 365 houve 120–132 organizações compradoras distintas por semente e no máximo uma proposta para cada atleta do elenco do usuário. Entre todas as abordagens, uma semente teve uma repetição da mesma dupla comprador e atleta. As demais não tiveram repetições. O JSON inclui funções, contagens individuais e avaliações de candidatos descartados por orçamento. Esses descartes são avaliações internas, não ofertas enviadas.

A simulação de balanceamento exerce o avaliador com dados controlados. Os testes do worker cobrem gravação, recusa e recarga. O horizonte de evidência oficial do avaliador usa até 120 dias da temporada corrente. Clubes rivais não têm contratos individuais completos no modelo atual. O perfil institucional é aproximado por equipe principal ou Academy.
