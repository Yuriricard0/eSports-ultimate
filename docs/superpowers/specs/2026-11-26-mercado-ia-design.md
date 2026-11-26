# Patch 03 · Mercado de transferências

A tela de venda consulta compradores na hora e retorna até 20 opções por atleta. A leitura é repetível e não representa propostas emitidas ao longo do calendário. O mercado mundial também preenche funções vagas com agentes livres, por um fluxo separado. A aprovação da abordagem integrada inclui propostas espontâneas e mantém a venda iniciada pelo usuário.

## Abordagens consideradas

Apenas reduzir o limite de compradores corrige parte da apresentação e deixa recusas e intervalos sem histórico. Substituir o mercado inteiro aumentaria o risco para contratos e saves existentes. A abordagem escolhida combina a cotação solicitada pelo usuário com propostas registradas e mantém os fluxos de pagamento e contratação existentes.

## Regras de interesse

Aplicar a mesma avaliação de comprador, atleta e função aos candidatos elegíveis do usuário e da IA. Vaga aberta ou ganho esportivo justificável é requisito. Considerar modalidade, faixa de habilidade observada, participações oficiais, desempenho recente disponível, exposição anterior verificável, idade, duração do vínculo e capacidade financeira. Tratar informação ausente como incerteza. A avaliação não lê o teto de potencial do atleta. Clubes com perfil de desenvolvimento podem aceitar mais incerteza em atletas jovens. Quando o catálogo não tiver uma filosofia explícita, usar um perfil conservador baseado no nível da equipe, sem atribuir uma política editorial a clubes reais.

Uma abordagem espontânea a um atleta desconhecido deve ser rara, com exceções para oportunidades justificáveis, como vaga aberta, contrato próximo do fim ou evidência observável da ranked. Abrir a tela de venda consulta compradores a pedido do usuário. Essa consulta e as abordagens espontâneas serão identificadas separadamente na interface e na medição.

## Persistência e frequência

Registrar abordagens com clube, equipe, função, atleta, vendedor, preço e datas de criação e expiração. Processar em dias definidos pelo calendário dentro da transação do avanço, com marca única por carreira e dia. Reabrir uma tela ou carregar um save apenas consulta registros existentes. Usar limites configuráveis por clube e por atleta, intervalo entre abordagens da mesma dupla e espera maior após recusa. Respeitar negociações abertas. Antes de concluir, validar novamente vínculo, vaga e orçamento. Nunca reescrever compras, contratos ou negociações existentes. A restauração deve incluir os registros novos quando presentes e continuar aceitando backups anteriores.

## Validação e balanceamento

Medir o fluxo anterior como opções encontradas por consulta e contratações efetivas. Ele não possui uma contagem histórica de propostas espontâneas. Na versão nova, medir cotações solicitadas, abordagens persistidas, repetições, recebedores sem experiência, distribuição por clube, funções demandadas, compras concluídas e recusas por orçamento. Comparar as mesmas sementes e janelas de 30, 90 e 365 dias. Repetir avanços diários e em lote para verificar a marca por dia e testar um atleta desconhecido antes e depois de adquirir histórico oficial. Ajustar limites a partir dos resultados e preservar as fórmulas de valor e salário.
