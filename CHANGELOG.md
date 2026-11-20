# Ultimate eSports Manager — V1 Alpha

## 1.0.0-alpha.1 — 19/11/2026

- Carreiras locais com identidade, mundo gerado, jogadores e elencos MOBA/Counter-Strike 2.
- Mercado e contratos, Academy e treinamento, amistosos, temporadas e campeonatos.
- Finanças, patrocínios, instalações, notícias e acontecimentos persistentes.
- Corrigida espera indefinida de novas ações após falha fatal do Worker de armazenamento.
- Corrigida troca de carreira durante avanço/atualização assíncrona, preservando os dados da carreira selecionada.
- Corrigida importação de contratos Godot com luvas zero. Migração transacional para SQLite web v10 preserva contratos, lançamentos e cópias antigas.
- Conferência dos elencos rivais passou a usar índices; regras de seleção e orçamento preservadas.
- Cache dos planos de treino e dos marcos de adaptação durante avanços; removida leitura desnecessária da identidade nos confrontos entre rivais.
- Teste integral cria carreiras reais, disputa três temporadas consecutivas em cada modalidade, reabre o banco e importa a exportação binária preservando a carreira original.
- Verificador local do build confere recursos, SQLite WASM, Worker, atlas de retratos, logos catalogadas e manifesto offline.

Condição de distribuição: candidata a Alpha interna. A validação no navegador (cliques, resoluções e OPFS real) continua pendente devido ao bloqueio de acesso local da sessão. Não publicar como versão final estável antes dessa conferência.
