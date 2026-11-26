# Evolução integrada do UEM News

## Objetivo e aprovação

Transformar a lista de registros em um portal esportivo offline, com conteúdo verificável e histórico persistente. A abordagem integrada foi aprovada pelo usuário em 25/11/2026. O documento detalha a proposta aprovada para execução.

## Abordagens

- Somente interface: entrega visual menor, mas mantém linguagem administrativa e exposição de informações internas; descartada.
- Evolução integrada: ampliar o modelo JSON existente, melhorar os produtores e reorganizar a apresentação; escolhida por preservar os sistemas atuais e atender ao pedido completo.
- Nova simulação de imprensa: fora do escopo definido pelo usuário.

## Arquitetura

Manter React, TypeScript, SQLite no worker e a tabela `web_news`. Adicionar campos opcionais ao JSON de NewsItem para conteúdo, modalidade, origem, relevância, entidades e composições editoriais. Não exigir migração destrutiva nem reescrever notícias antigas. Identificadores de evento continuam únicos por carreira.

Novos registros guardam os dados conhecidos no acontecimento. Modalidade registrada tem prioridade sobre inferências do estado atual. Registros antigos sem contexto suficiente exibem apenas seu texto e dados verificáveis, sem reconstruir clubes anteriores a partir de vínculos atuais.

## Conteúdo e privacidade

Usar variações determinísticas por identificador do evento e contexto disponível. Não inventar falas, valores, estatísticas, reputação histórica ou acontecimentos. Moral, desenvolvimento interno e potencial oculto não se tornam cobertura pública automaticamente. Preservar registros antigos, mas distinguir comunicação interna da cobertura pública. Nenhuma publicação diária artificial.

Cobrir contratações confirmadas de outras organizações, resultados relevantes e títulos já registrados. Agrupar resultados regulares do cenário por competição e rodada quando houver dados suficientes. Manter placares e datas individuais verificáveis no conteúdo dos resumos.

## Interface

Manter navegação global. Portal com identidade preta, azul-marinho, carmesim e branco, manchete principal selecionada por relevância entre acontecimentos recentes, cards secundários e últimas notícias cronológicas paginadas. Leitura completa acessível, filtros combináveis por modalidade, organização, categoria e pesquisa incluindo conteúdo.

Categorias aparecem quando houver dados correspondentes: Todas, Minha organização, Competições, Mercado, Jogadores e talentos, Mundo competitivo. Mensagens internas e decisões ficam visualmente distintas das notícias públicas, utilizando os destinos existentes quando aplicável.

Composições locais reutilizáveis para confronto/placar, transferência, conquista e atleta, com alternativas para imagens ausentes. Links somente para entidades disponíveis; perfil atual identificado como tal. Organizações e competições devem abrir o contexto correspondente existente.

Central da Carreira mostra até três notícias relevantes com categoria, data, miniatura e botão “Ver todas as notícias”.

## Validação e entrega

Testar carreiras novas e antigas, lista vazia, volume, filtros combinados, pesquisa no conteúdo, MOBA/FPS, entidades indisponíveis, transferências sucessivas, datas históricas, recarga, backup, duplicação e privacidade. Executar testes existentes, compilação e verificação do build offline. Inspecionar desktop e mobile, imagens ausentes e leitura completa; capturar telas reais e exemplos gerados pela simulação.

Sem novas dependências de rede para conteúdo ou imagens. Limites, desempenho observado e qualquer cenário não validado devem constar do relatório final.
