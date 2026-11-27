# V1.5 — Calibração e leitura tática

## Amostra

A linha de base usou 11.000 partidas. A rodada final usou 13.000 partidas, com 500 seeds por cenário e modalidade. Os elencos sintéticos têm cinco atletas, um por função. A comparação de estratégias usa o mesmo elenco nas duas condições. As porcentagens descrevem esta amostra.

Para gerar o relatório detalhado em JSON, execute `node tools/calibrate-matches.mjs 500`. O relatório inclui a probabilidade pré-jogo, taxas empíricas de vitória, viradas, domínio, duração e distribuição das notas por função em cada cenário.

## Taxa de vitória da equipe mais forte

| Diferença de Overall | MOBA antes | MOBA depois | CS2 antes | CS2 depois |
| --- | ---: | ---: | ---: | ---: |
| 5 | 63,0% | 60,2% | 67,4% | 59,6% |
| 15 | 87,6% | 82,8% | 91,6% | 79,8% |
| 30 | 93,8% | 93,8% | 98,4% | 88,4% |

No MOBA, o peso final dos abates e dos objetivos foi reduzido para moderar a vantagem que já aparece nos confrontos anteriores. No CS2, o peso da força pré-jogo por round foi reduzido porque o efeito acumulava ao longo do mapa.

## Cenários equilibrados

| Medida | MOBA | CS2 |
| --- | ---: | ---: |
| Vitórias da equipe da casa | 49,8% | 48,4% |
| Ganho com moral de 85 contra 35 | 4,4 p.p. | 2,4 p.p. |
| Ganho com 149 contra 0 dias de entrosamento | 5,4 p.p. | 4,6 p.p. |
| Ganho com Sangue Frio | 1,0 p.p. | 1,0 p.p. |
| Ganho do plano compatível sobre o mesmo elenco especializado | 4,8 p.p. | 3,2 p.p. |
| Viradas a partir do primeiro confronto ou round | 43,0% | 40,8% |
| Domínio completo | 8,0% | 5,8% |
| Duração mediana | 34 min | 37,4 min |

Domínio completo significa pelo menos três vezes os abates do perdedor no MOBA ou vitória com o adversário marcando no máximo quatro rounds no CS2. Os valores de visão, experiência e pressão das fases do MOBA representam indicadores agregados dos eventos simulados.

## Compatibilidade

O simulador grava fases, acontecimentos táticos e notas no JSON que já armazena o resultado. Partidas antigas continuam com seu placar e sua linha do tempo original. A visão 2D usa marcos das partidas novas e traça posições esquemáticas a partir deles. Os mapas de CS2 são diagramas próprios, com afinidade calculada pelos atributos atuais da equipe e rotação sem repetição na série.
