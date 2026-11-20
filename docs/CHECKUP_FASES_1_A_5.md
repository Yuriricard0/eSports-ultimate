# Checkup geral — 18/11/2026

Cobertura: base existente das Fases 1/2 e escopos simplificados V1 das Fases 3, 4 e 5. Verificação por testes automatizados, integração em SQLite real, revisão do código, TypeScript e compilação de produção.

| Área | Verificação | Resultado |
|---|---|---|
| Carreiras e identidade | Criação, sigla de três letras, validações, exclusão independente, backup, conversão Godot | Passou |
| Jogadores e mundo | Atributos, fórmulas de Overall, funções, geração, ranked, países, vínculos, catálogo e evolução de cinco temporadas | Passou |
| Mercado e contratos | Livres, compras, vendas, dispensas, renovações, recusas, folha, orçamento, conflitos e reposição rival | Passou |
| Academy | Entrada elegível, promoção, contrato único, preservação de salário, titularidade e importados | Passou |
| Treinamento | Quatro focos, evolução mensal, idade, potencial, Overall, principal/Academy e persistência | Passou |
| MOBA | Cinco titulares, força coletiva, eventos, duração, objetivos, placar, MVP e K/D/A coerentes | Passou |
| FPS | Rounds, vitória em 13, prorrogação simples até 16, viradas, MVP e K/D/A coerentes | Passou |
| Condições | Moral, forma, fadiga e recuperação; resultados preservam habilidade e Overall | Passou |
| Salvamento de partidas | Atualização atômica, rollback induzido, conclusão única, recarga, histórico e backup V6 | Passou |
| Integração | Reservas/Academy fora dos titulares, importados incluídos, jogadores sem duplicação e elencos revalidados na simulação | Passou |

Suíte completa: 65 testes aprovados. Verificação TypeScript e compilação de produção aprovadas. Os testes de integração usam os comandos do Worker com uma adaptação para SQLite nativo em arquivos temporários; não mexem nos saves pessoais. Os testes repetidos confirmam favoritos vencendo mais e resultados inesperados possíveis nos dois jogos.

A revisão independente da Fase 5 não apontou problemas importantes no escopo V1. O projeto Godot e seus arquivos permanecem preservados.

## Conferência ainda pendente

Verificação visual dos cliques, layout em diferentes tamanhos e comportamento do OPFS real no navegador. O acesso ao navegador local havia sido recusado na conversa; essa parte não foi simulada nem declarada concluída.

## Como jogar a Fase 5

1. Completar as cinco funções titulares na tela Elenco; promover atletas da Academy antes de escalá-los.
2. Abrir Partidas, selecionar uma equipe adversária e preparar o amistoso.
3. Conferir as escalações e clicar em Simular Partida.
4. Consultar resultado, MVP, estatísticas e acontecimentos. O registro fica salvo no histórico.

Amistosos acontecem na data atual e não geram receitas ou evolução de habilidade. O avanço de dias continua controlando salário, treino e recuperação. Agenda competitiva e campeonatos ficam para a Fase 6.
