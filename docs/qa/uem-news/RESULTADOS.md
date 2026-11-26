# UEM News — resultados da implementação

Implementado no checkout `main`, conforme solicitado. Código, testes e documentação preparados para envio ao repositório pessoal `Yuriricard0/eSports-ultimate`; as capturas permanecem locais.

## Entrega

Portal UEM News com manchete escolhida por relevância, cards secundários, últimas notícias cronológicas paginadas, leitura completa em diálogo, filtros combináveis e pesquisa por título, resumo e conteúdo. As categorias dependem de notícias existentes. O destaque é consultado independentemente da página cronológica, para que um título relevante não desapareça após muitas notícias comuns.

Composições locais para resultado/placar, contratação, conquista, organização e atleta. Logos indisponíveis têm alternativa por sigla. Nenhuma chamada a geradores de imagem ou dependência remota foi adicionada. A navegação global permanece a existente.

A Central apresenta até três destaques públicos e “Ver todas as notícias”. Notícias, mensagens internas e acesso às decisões da Central ficam separados. Relatórios antigos de moral, desenvolvimento e observação continuam armazenados, mas saem da cobertura pública.

Novos textos usam variações determinísticas e dados de eventos registrados. Snapshots textuais, modalidade, entidades relacionadas, placar, competição, origem e relevância ficam no JSON existente. Notícias já persistidas não são reescritas. Resultados regulares das outras organizações são agrupados por competição, rodada e data, com os placares preservados no conteúdo. Não se criam notícias para preencher dias sem eventos.

Na inspeção real de restauração, um backup de 21 MB revelou um defeito da alocação de bytes do SQLite WASM: a biblioteca obtinha a referência da memória antes de uma alocação capaz de expandi-la. A cópia agora readquire a referência após alocar; teste com crescimento real de WebAssembly.Memory e importação no navegador confirmaram a correção.

## Testes e resultados

| Verificação | Resultado observado |
|---|---|
| Suíte completa, rodada principal após correção de importação | 124 testes aprovados, zero falhas, 274,2 s |
| Verificação final focada após variação de títulos e destaque independente | 18 testes aprovados, zero falhas, 37,8 s |
| TypeScript e build de produção final | `npm run build`, saída 0 |
| Manifesto offline final | `npm run verify:build`, 283 arquivos, 60,73 MiB, zero ausentes |
| Integridade de alterações | `git diff --check`, saída 0 |
| Carreiras e restauração | Temporadas completas MOBA/FPS, recarga, backup/restauração e ausência de duplicação nos testes do worker |
| Histórico | JSON legado intacto; alteração posterior de nome/clube não reescreve notícia; modalidade registrada prevalece sobre estado atual |
| Filtros | Modalidade, organização principal/relacionada, categoria, cenário externo, conteúdo e letras acentuadas; paginação aplicada depois dos filtros |
| Volume | 1.000 registros; páginas de 50, página excedente vazia, destaque relevante abaixo das 20 notícias mais recentes |
| Privacidade | Moral, desenvolvimento e prospecção são mensagens, inclusive quando o registro legado não possui canal |
| Navegador | Importação de backup de 21 MB, carreiras MOBA/FPS, estado vazio, leitura completa, pesquisa e filtros combinados |
| Links | Competição abre temporada/edição corretas; organização abre seu perfil específico; ações de confronto são exibidas apenas após verificar existência |
| Offline | Preparado cache no navegador, desligado o servidor, recarregado o jogo e abertas Central e notícias com recursos locais |

Comandos usados: `npm test`; `node --test tests/news.test.ts tests/news-worker.test.ts tests/sqlite-bytes.test.ts tests/competition-worker.test.ts`; `npm run build`; `npm run verify:build`; `git diff --check`.

A suíte principal incluía testes de seis temporadas por modalidade e restauração binária; a verificação focada final cobre os últimos ajustes sem repetir toda essa simulação. Os logs completos ficam no diretório ignorado `.superpowers/sdd/2026-11-25-uem-news/` enquanto este checkout existir.

## Exemplos reais da simulação

O utilitário `node tools/qa-news.ts` utiliza as ações reais de criação, contratação, avanço do calendário e disputa do worker. Gera um backup de teste em um novo arquivo no diretório ignorado e grava os exemplos em `exemplos-simulacao.json`. Não injeta manchetes artificiais para as capturas.

Na execução inspecionada:

- MOBA, dia 80: 78 notícias públicas. “TOP ESPORTS é campeão de Liga China”; “MVK Esports supera Relove Deep Cross Gaming em Liga Ásia-Pacífico”, com placar real 2 × 3; resumos de rodadas com placares de outras organizações.
- FPS, dia 206: 37 notícias públicas. “Luminosity é campeão de Major de Counter-Strike”, com composição local e sigla quando não há logo.
- Carreira nova, dia 1: nenhuma notícia pública; estado vazio sem publicações inventadas.

Os exemplos e capturas representam os registros preservados daquela execução. Novos acontecimentos podem usar os outros modelos determinísticos; registros anteriores mantêm o texto que já foi salvo.

Consultas completas, incluindo sincronização, medidas no harness: MOBA 253 ms na primeira leitura e 141 ms na repetição; FPS 178 ms e 157 ms. São medidas locais de duas carreiras, não uma garantia para qualquer máquina ou carreira.

## Capturas

Os PNGs abaixo permanecem locais e estão excluídos do versionamento: as capturas da janela incluem abas de outros projetos no navegador. O código, os testes e os exemplos JSON podem ser publicados sem essas imagens.

- [Portal desktop](portal-desktop.png)
- [Leitura completa](leitura-completa.png)
- [Portal FPS e alternativa sem logo](portal-fps.png)
- [Ausência de notícias](sem-noticias.png)
- [Filtros em largura reduzida](portal-largura-reduzida.png)
- [Cards em largura reduzida](cards-largura-reduzida.png)
- [Central com três destaques, servidor desligado](central-offline.png)
- [Portal com servidor desligado](portal-offline.png)

As capturas de largura reduzida usam uma janela de 954 px com zoom de 200%, equivalente a aproximadamente 477 px CSS. Não substituem um teste em dispositivo móvel físico. A navegação global existente não foi redesenhada.

## Arquivos alterados/criados

| Arquivo | Responsabilidade |
|---|---|
| `src/game-core/news.ts` | Campos editoriais opcionais, seleção, busca, categorias disponíveis, privacidade, snapshots, textos e resumos de rodada |
| `src/app/News.tsx` | Portal, destaques da Central, composições, leitura e ações contextuais |
| `src/styles.css` | Estilos isolados do portal, diálogo e adaptação de largura |
| `src/app/App.tsx` | Encaminhamento contextual de organização e competição |
| `src/app/WorldDirectory.tsx` | Abertura do perfil da organização referenciada |
| `src/app/Competitions.tsx` | Abertura de temporada/edição referenciada |
| `src/persistence/sqlite-bytes.ts` | Cópia segura após expansão da memória WASM |
| `src/persistence/worker.ts` | Uso da cópia segura na importação |
| `tests/news.test.ts` | Histórico, privacidade, filtros, busca, textos, volume e relevância |
| `tests/sqlite-bytes.test.ts` | Regressão da importação com expansão de memória |
| `tests/helpers/worker-harness.ts` | Adaptação de alocação para os testes de persistência |
| `tools/qa-news.ts` | Reprodução de carreiras e exemplos reais |
| `docs/superpowers/` | Desenho e plano aprovado |
| `docs/qa/uem-news/` | Relatório, exemplos JSON e capturas |

## Revisão e limites

Uma revisão independente de código não encontrou problemas críticos de privacidade, preservação de histórico ou duplicação. O ajuste de seleção dos destaques apontado na revisão foi corrigido e recebeu teste de regressão. A inicialização do perfil da organização foi corrigida e confirmada no navegador.

A revisão independente não repetiu a inspeção visual nem a suíte; essas evidências foram coletadas pelo implementador. Não foi ampliado o tratamento de backups com JSON deliberadamente inválido fora do formato aceito pelo validador atual. Não se afirma desempenho de carreiras arbitrariamente grandes além das medições descritas.

A ausência de entidades é tratada por validação dos destinos antes de oferecer ações; nem toda combinação possível de entidade excluída foi reproduzida manualmente no navegador. O teste offline interrompeu o servidor de origem local, sem alterar a conectividade do computador. Novas modalidades, rumores, redes sociais, declarações de imprensa, promoções ou outros fatos sem produtores existentes não foram simulados artificialmente.
