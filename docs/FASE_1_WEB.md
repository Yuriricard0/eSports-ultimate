# Fase 1 web

O checklist do executável e o prompt da web definem a entrega.

- Editor com dez formatos, 54 símbolos, cinco padrões, três cores, texto, prévia clara e escura e PNG. Aplicar na criação e na edição de uma carreira. Verificar gravação e recuperação da identidade.
- Cópias SQLite. Validar a origem e importar em uma transação, com novo ID, preservando o estado da cópia. Testar rollback e isolamento. Tratar a conversão do Godot explicitamente para não confundir IDs de atletas dos dois catálogos.
- Menu com retomada da última carreira aberta, configurações e créditos. Persistência independente por origem e bloqueio entre abas.
- Build com cache de todos os recursos necessários para rodar offline. Verificar a instalação do cache e deixar claro quando o primeiro download ainda estiver em andamento.

## Entrega

- O menu abre o editor sem criar um save. O editor também fica disponível durante a criação e dentro da carreira. Forma, borda, cores, padrões, tipografia, texto, posição e escala são salvos com a identidade. A prévia inclui fundo claro e escuro e uma versão pequena. PNG tem limite de 4 MB e 2048 × 2048.
- A seleção de país informa a região geográfica. A região competitiva permanece no trabalho da Fase 2. Continuar abre a última carreira usada e cai na mais recente caso ela tenha sido excluída. Renomear altera o rótulo do save. O nome da organização é preservado.
- SQLite WASM mantém os saves no OPFS. As mudanças são transacionais. O navegador permite uma aba editora por origem. A versão 3 adiciona tabelas para identidade, nome do save e arquivo Godot. Backups web v1 a v3 são restaurados com novos IDs e preservam a carreira que já estiver aberta.
- A importação do Godot 9 a 15 transfere clube, escudo, dificuldade, saldo, dia, atletas ligados ao clube, escalação, atributos, histórico dos atletas e contratos ativos encontrados. O arquivo legado inteiro continua disponível para baixar. O mundo rival usa o catálogo web. Retratos personalizados e contratos encerrados continuam no arquivo legado. Para recuperar o elenco em uma carreira trazida pelo importador anterior, baixe seu original Godot e importe como outra carreira.
- Configurações inclui alto contraste, tela cheia quando disponível e preparação offline. A compilação gera o manifesto do cache com o app, SQLite e catálogos. Para preservar o acesso aos saves locais, abra o mesmo endereço e use o mesmo perfil do navegador. O cache offline não é um backup dos saves.

## Validação e pendências

Os testes automatizados cobrem identidade, limites de PNG, restauração sem sobrescrita, rollback e conversão do saldo legado. Três cópias demonstrativas do Godot dos esquemas 9, 13 e 15 foram verificadas em modo somente leitura. A conferência do build encontrou os 282 arquivos do manifesto offline, incluindo Worker e WASM. A sessão de teste no navegador não recebeu acesso ao endereço local. Ainda é necessário verificar a interface e abrir o jogo sem rede em HTTPS ou localhost.
