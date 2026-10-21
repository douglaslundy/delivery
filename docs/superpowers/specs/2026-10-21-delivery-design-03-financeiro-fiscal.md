# Delivery Platform — Design 03: Financeiro e Fiscal

Parte 3 de 5. Models em `01-domain-model.md` (`FinanceCategory`, `BankAccount`, `FinanceEntry`, `FiscalDocument`).

## Fluxo de caixa diário

- Toda venda `COMPLETED` gera automaticamente um `FinanceEntry` (`kind='INCOME'`, vinculado ao `orderId`, `paidAt = now()`), sem passo manual do usuário.
- Fechamento de caixa do dia é um relatório (não uma tabela própria): soma `FinanceEntry` do dia, agrupado por `BankAccount`/método de pagamento. Calculado on-demand, não pré-agregado no V1 (volume baixo o suficiente pra não precisar de tabela de resumo materializada).

## Contas a pagar/receber

- `FinanceEntry` sem `orderId` = lançamento manual (fornecedor, aluguel, etc.).
- `dueDate` presente + `paidAt` nulo = pendente; `paidAt` preenchido = baixado.
- Categorização via `FinanceCategory` (`kind = INCOME|EXPENSE`), lista inicial de categorias padrão criada no onboarding (passo de "estabelecimento", ver doc 05), editável depois.

## Conta bancária

- `BankAccount.initialBalanceCents` + soma de `FinanceEntry` até a data = saldo atual. Sem integração de open banking no V1 — é só registro manual/semi-automático (vindo das vendas).
- Loja pode ter mais de uma conta (ex.: dinheiro físico + conta PJ); todo `FinanceEntry` aponta pra uma conta ou fica "sem conta" (dinheiro em caixa não bancarizado).

## Relatórios (V1)

- Fluxo de caixa por período (dia/semana/mês), filtrável por conta e categoria.
- Contas a pagar/receber em aberto, com alerta visual simples para vencidas (`dueDate < hoje` e `paidAt` nulo).
- Faturamento por canal (`OrderChannel`) e por produto (ranking de mais vendidos) — útil pro dono decidir cardápio.

Implementação dos relatórios fica para quando o builder chegar nessa fatia do plano; aqui só fixamos as queries que precisam ser suportadas pelo schema (todas cobertas pelos índices já definidos em `01-domain-model.md`).

## Fiscal (NFC-e) — reserva, não implementação

- Tabela `FiscalDocument` existe desde o V1 (schema), mas **nenhuma rota/job emite nota fiscal real** nesta fase.
- Quando chegar a hora de implementar: usar a skill `br-fiscal-note-emission`, que cobre engines (Focus NFe/Spedy/NFePHP), CFOP/CST-CSOSN/ICMS, certificado A1, idempotência e reconciliação de status — não redesenhar essas regras aqui.
- Gatilho natural de emissão será `Order.status = COMPLETED` num canal que exige NFC-e (depende de legislação municipal/estadual do cliente específico) — decisão de *quando* emitir fica para a fase fiscal, não para o V1.
