# Fase 4 V1 — Academy e treinamento básico

Escopo: prompt de 18/11/2026. Academy utiliza atletas e contratos da organização. Treinamento reutiliza os ciclos e fórmulas atuais de evolução, sem crescimento adicional paralelo.

Decisões: entrada na Academy entre 16 e 21 anos (idade verificada no dia); promoção a qualquer idade, sem nova contratação ou cobrança. Contratações continuam pelo Mercado existente. Os quatro focos são Mecânica, Estratégia, Comunicação e Equilibrado. Equilibrado preserva a evolução atual; os demais redistribuem lentamente os ganhos entre atributos, mantendo idade, potencial e Overall atuais. Foco não acelera declínio nem produz ganho ao clicar.

- [x] Testar ingresso/promoção, elegibilidade, contrato único e escalação principal.
- [x] Implementar configuração persistida por atleta; reutilizar contratos e folha.
- [x] Integrar focos ao desenvolvimento mensal de jogadores contratados, inclusive importados; remover configuração na saída/expiração.
- [x] Criar telas Academy e Treinamento com componentes e visual existentes.
- [x] Testar recarga, backup, evolução gradual, modos MOBA/FPS e regressões; conferir TypeScript e build.

Sem scouting, tryouts, comissão, instalações, competições ou desenvolvimento avançado. Sem alterar o projeto Godot e saves pessoais. Validação visual do navegador permanece sujeita à disponibilidade de acesso.

## Resultado e verificação

Configuração na tabela auxiliar `web_player_training`, uma linha por carreira/atleta; contratos originais preservados. O banco V5 e o backup incluem Academy, foco e dia de alteração; versões anteriores continuam aceitas. Vendas, dispensas e expirações removem a configuração. Academy não entra na escalação, força e contagem de reservas do principal, mas continua na folha salarial e protegida da IA de mercado.

Os testes executam comandos reais do Worker com SQLite nativo em arquivo temporário: atualização de banco V4, entrada na Academy, foco, avanço de 30 dias, evolução do principal e de importados, reabertura do arquivo, promoção e saída. Testes de domínio cobrem faixas etárias, fórmulas de Overall MOBA/FPS, potencial, avanço diário versus lote, backup V5 e exclusão de Academy nas reposições automáticas da escalação. A revisão identificou e corrigiu a volta à titularidade de importados sem contrato web, sem inventar condições financeiras.

Uso: contratar jovens no Mercado, abrir Academy e adicionar os elegíveis; promover pelo mesmo painel. O foco pode ser alterado na Academy ou na tela Treinamento para qualquer atleta da organização. Ganhos aparecem nos ciclos atuais de 30 dias, nunca ao clicar no seletor. Validação visual e OPFS real no navegador permanecem pendentes, pois o acesso local havia sido recusado nesta conversa.
