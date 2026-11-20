# Ultimate eSports Manager — relatório V1 Alpha

Data: 19/11/2026. Identificação: **V1 Alpha · 1.0.0-alpha.1**. Banco web v10, com leitura de backups anteriores mantida.

## Situação

Candidata a **Alpha interna**. O ciclo de carreira foi exercitado automaticamente de ponta a ponta, com três temporadas consecutivas em MOBA e três em Counter-Strike 2. A publicação como versão estável permanece condicionada à validação real no navegador.

## Funcionalidades testadas

| Sistema | Evidência executada |
|---|---|
| Carreira e mundo | Comando real de criação, geração determinística com catálogo completo, identidade, consulta e IDs únicos |
| Jogadores e Overall | Atributos, funções, limites, estimativas públicas, evolução gradual e resultados sem alterar habilidade |
| Mercado e contratos | Propostas, contrapropostas, recusas, contratação, compra/venda, dispensa, renovação, orçamento e duplicação |
| Academy e treino | Ingresso, promoção, retorno ao principal, escalação, foco, bônus de instalações e persistência |
| Partidas | Amistosos MOBA/CS2, placares, MVP, estatísticas, condições, probabilidades e conclusão única |
| Campeonatos | Ligas/torneios, calendário, IA, playoffs, séries jogo a jogo, desempates, campeões e anos seguintes |
| Finanças | Salários, atrasos, prêmios únicos, patrocínios, melhorias e reconciliação saldo inicial + extrato |
| Notícias | Fatos reais, disponibilidade atual, filtros, ordenação, eventos moderados e ausência de repetição |
| Persistência | Reabertura física entre temporadas, exportação binária, importação por comando do Worker e preservação da carreira original |
| Compatibilidade | Importação Godot com luvas zero, fonte original preservada, migração de contrato/financeiro e rollback induzido |
| Navegação/erros | Troca de carreira durante avanço e falha fatal do Worker reproduzidas em testes isolados de componente/repositório |

## Bugs encontrados e corrigidos

- **Armazenamento travado após falha:** futuras requisições não terminavam depois de um erro fatal do Worker. Agora falham imediatamente e orientam recarregar.
- **Troca de carreira durante atualização:** dados de A podiam substituir os de B e deixar páginas em carregamento. A seleção atual é conferida antes de todos os commits de estado relacionados.
- **Importação de contrato sem luvas:** bônus zero permitido pelo Godot era recusado. O esquema v10 relaxa somente essa restrição, com migração atômica e sem cobrança inventada.

Os três defeitos tiveram testes reproduzindo a falha antes da correção. A revisão independente não encontrou outro bloqueador importante nas alterações revisadas. A suíte continua verificando os defeitos corrigidos nas fases anteriores.

## Testes e build

Suíte final após compatibilidade Godot: **92/92 testes aprovados**, zero falhas, zero testes ignorados, em **84,18 segundos**. Inclui três temporadas completas por modalidade com criação real e exportação/importação binária. Os testes anteriores de cinco temporadas de evolução e os testes de campeonatos/finanças também passaram. Revisão independente refez os testes focados das correções e da migração sem apontar outro bloqueador importante.

Comandos de verificação:

```text
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --configLoader native
node tools/verify-build.mjs
```

TypeScript e build de produção concluídos sem erros. Verificador local conferiu **282 arquivos, 60,65 MiB, 40 atlas de retratos** e as referências catalogadas de 556 organizações/602 equipes; **nenhum recurso referenciado ausente**. Isso não significa que todas as organizações possuam uma logo: as alternativas existentes foram preservadas. O manifesto offline, o Worker e o SQLite WASM estão incluídos. Logs diagnósticos desnecessários do repositório foram removidos.

## Desempenho medido

Na execução automatizada com SQLite nativo, as carreiras chegaram aos dias 811 (MOBA) e 937 (CS2), completando três temporadas cada. Os backups tinham aproximadamente 20,59 MiB e 19,61 MiB.

Após as otimizações, a execução final da suíte mediu médias de aproximadamente 607/563 ms para avanço e 418/322 ms para séries MOBA/CS2; exportação em 13–16 ms e importação em 489–517 ms. Houve contenção com outros testes. Esses números são indicadores do motor no ambiente local, não garantias de desempenho do navegador.

A conferência isolada de elencos rivais caiu de 53,21 ms para 5,08 ms em dez repetições do catálogo real. Regras e resultados funcionais foram preservados.

## Salvamentos e temporadas

As ações continuam persistindo automaticamente por transação. Não existe um botão separado de salvamento manual da carreira; o comando manual disponível é a exportação de backup. Os testes fecham/reabrem o banco e importam arquivos binários reais, mantendo contratos, Academy, focos, dinheiro, patrocinadores, instalações, mapas, campeonatos, títulos e notícias. Resultados anteriores permanecem ao iniciar outro ano. O controle de premiação única foi mantido.

Nenhum save pessoal foi apagado ou alterado. O projeto Godot original foi apenas consultado para conferir a restrição de luvas; testes usaram arquivos temporários próprios. A adaptação de armazenamento dos testes usa SQLite nativo e cópia binária em arquivo somente leitura para importação; não testa a desserialização WASM/OPFS real do browser.

## Pendências e riscos conhecidos

- **Não executados:** Chrome, Edge e Firefox; inspeção visual em 1366×768 e 1920×1080; cliques completos, console e recarga de página na produção; OPFS e atualização offline no navegador real.
- Motivo: uma permissão salva/gerenciada recusou o acesso ao endereço local no navegador integrado. Não foi usada outra superfície ou porta para contornar a restrição.
- Integridade dos arquivos do build foi testada em disco. Não equivale a confirmar que o bundle inicia e percorre uma carreira em um navegador real.
- Balanceamento foi verificado por invariantes, probabilidade e economia reconciliada; ainda precisa de sessões humanas para avaliar dificuldade e ritmo.

Não há bloqueador confirmado restante nos testes automatizados; os limites acima impedem classificar a versão como validada para lançamento público estável.

## Conferência manual para liberar a Alpha

1. Autorizar o navegador local e abrir a versão de produção por HTTP em localhost.
2. Criar e continuar uma carreira em Chrome/Edge; repetir abertura, gravação e recarga no Firefox quando disponível.
3. Repetir as telas principais em 1366×768 e 1920×1080, verificando rolagem, textos, botões e contraste.
4. Contratar, promover/treinar, disputar um amistoso e uma série da Agenda; conferir finanças, notícias e título/histórico quando houver.
5. Recarregar, exportar/restaurar uma cópia e testar o modo offline. Conferir ausência de erros no console e retenção do armazenamento.

Recomendação: usar a build como candidata a Alpha interna e executar essa conferência antes de anunciar prontidão pública. Não foram adicionadas modalidades ou mecânicas de jogo na Fase 9.
