# Fase 9 V1 — auditoria e preparação Alpha

Escopo do prompt de 19/11/2026: testar e estabilizar o fluxo existente das Fases 1–8, sem novas mecânicas e sem redesenhar a Central.

- [x] Auditar implementação, inicialização, navegação, salvamento, atualização offline e empacotamento; registrar bugs confirmados e correções locais.
- [x] Executar criação real pelo comando do Worker, geração real, montagem e movimentação de elenco, Academy/treino, amistoso e campeonatos nas duas modalidades.
- [x] Completar três temporadas consecutivas em cada modalidade, incluindo calendário, salários, patrocínios, resultados, notícias, contratos/renovações e histórico.
- [x] Reabrir banco entre temporadas; exportar e importar cópia binária SQLite usando os comandos existentes, preservando carreira original e toda a evolução.
- [x] Medir tempos de geração, listas, avanço, simulação e salvamento. Corrigir apenas gargalos evidentes.
- [x] Verificar build/arquivos locais, versões e recursos offline; identificar V1 Alpha e documentar alterações.
- [x] Executar suíte final após a correção de compatibilidade Godot e completar o relatório com o resultado.

Limite conhecido: uma permissão salva/gerenciada bloqueou a abertura de http://127.0.0.1:4173 no navegador integrado. Não contornar por outro navegador, porta, CDP ou automação. Testes Chrome/Edge/Firefox, resoluções 1366×768/1920×1080, cliques e OPFS do navegador serão listados como pendentes se o bloqueio continuar. Os testes automatizados usam os mesmos comandos/SQL do Worker com SQLite nativo em arquivos temporários; isso não equivale a testar o navegador.

## Correções confirmadas

1. Requisições após falha fatal do Worker ficavam pendentes indefinidamente. O repositório agora mantém o erro e rejeita novas ações com orientação para recarregar. Exceções de postMessage também removem a requisição pendente.
2. Respostas antigas de avanço/atualização podiam sobrescrever os dados da carreira recém-selecionada. Todas as atualizações de contexto agora conferem a carreira ativa, incluindo identidade, escalação e exclusão.
3. Contrato Godot com signing_bonus_cents=0 era válido no esquema original, mas rejeitado pela restrição web. A migração transacional v10 permite luvas zero, preserva contratos/lançamentos e restaura o esquema anterior se houver falha.

Cada bug teve reprodução automatizada antes da correção e verificação posterior. Revisão independente confirmou as correções e a ordenação das dependências da migração.

## Otimização

Índices locais de vagas ocupadas, livres por modalidade/função e posição no vetor substituem varreduras repetidas na manutenção dos elencos rivais. Seleção e validação financeira foram preservadas. Planos de treino e marcos de adaptação são preparados uma vez por avanço; partidas entre rivais não recarregam a identidade da carreira.

Benchmark local da manutenção de elencos, dez repetições com catálogo real: média de 53,21 ms antes para 5,08 ms depois. Não é uma medição de renderização ou de OPFS no navegador.

Fechamento: 92/92 testes aprovados em 84,18 segundos, TypeScript aprovado, build de produção aprovado e 282 recursos conferidos sem referências ausentes. Relatório: RELATORIO_V1_ALPHA.md. Identificação V1 Alpha · 1.0.0-alpha.1; candidata a teste interno, com validação visual/browser/OPFS ainda pendente.
