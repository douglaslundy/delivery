# Delivery Platform — Design 02: Máquina de estados de pedido + Realtime/KDS

Parte 2 de 5. Ver `00-overview.md` para contexto geral e `01-domain-model.md` para os models `Order`/`OrderStatusEvent`.

## Máquina de estados (`OrderStatus`)

Transições válidas por canal (`OrderChannel`). Toda transição grava um `OrderStatusEvent` (append-only, nunca sobrescreve).

```
RECEIVED -> CONFIRMED -> PREPARING -> READY -> [DELIVERY: OUT_FOR_DELIVERY -> DELIVERED] -> COMPLETED
                                                [PDV/SALAO: READY -> COMPLETED direto, sem OUT_FOR_DELIVERY/DELIVERED]
Qualquer estado antes de COMPLETED -> CANCELED (terminal)
```

- **PDV**: fluxo mais curto, geralmente `RECEIVED -> CONFIRMED -> PREPARING -> READY -> COMPLETED` quase imediato (pedido pago na hora, retirado no balcão).
- **SALAO**: igual ao PDV mas com `tableNumber` obrigatório; `COMPLETED` dispara fechamento de conta da mesa.
- **DELIVERY**: passa por `OUT_FOR_DELIVERY` (designado a um `DeliveryPerson`) antes de `DELIVERED`; `COMPLETED` é o fechamento financeiro/pós-entrega.
- **AGENDADO**: fica em `RECEIVED` (ou um sub-estado `SCHEDULED` se o builder achar necessário) até `scheduledFor` se aproximar, aí segue o fluxo normal do canal de destino (delivery ou salão).

Validação de transição fica centralizada numa função pura (`canTransition(current, next, channel)`), não espalhada em handlers de rota — facilita teste unitário e evita estado inválido salvo no banco.

## Canal realtime (WebSocket próprio)

- Servidor: `ws`/Socket.IO embutido no mesmo processo Next (custom server ou route handler com upgrade, dependendo do que o Next 16 permitir nessa versão — builder valida na hora).
- **Escopo de sala por tenant**: cliente conecta e entra na room `store:{storeId}`; nunca recebe evento de outra store (isolamento multi-tenant no realtime, não só no banco).
- Sub-rooms por função dentro da store, para não floodar quem não precisa:
  - `store:{storeId}:kds` — tela de cozinha, recebe todo `OrderStatusEvent` de pedidos ativos.
  - `store:{storeId}:orders` — acompanhamento geral (atendente/gerente).
  - `store:{storeId}:delivery:{deliveryPersonId}` — só os pedidos designados a esse entregador.
- Evento único de payload pequeno: `{ type: 'order_status_changed', orderId, status, channel, updatedAt }`. Cliente que recebe decide se refaz fetch do pedido completo ou usa o payload direto — manter o evento magro evita vazar dados sensíveis (ex. endereço do cliente) pra quem só precisa do status.
- Auth do socket: reusa a sessão next-auth (cookie) na conexão; servidor valida `storeId`/role antes de deixar entrar numa room.
- Fallback: se o socket cair, cliente reconecta e faz um fetch REST de reconciliação (`GET /api/orders?status=active`) — não depender só do stream para nunca perder estado.

## Payload de criação/atualização de pedido

Não verificado no sistema original (conta de teste não tinha pedido real gerado) — desenhado do zero aqui:

```ts
POST /api/stores/:storeId/orders
{
  channel: 'PDV' | 'SALAO' | 'DELIVERY' | 'AGENDADO',
  tableNumber?: string,       // SALAO
  scheduledFor?: string,      // AGENDADO, ISO datetime
  customerId?: string,
  deliveryAddress?: {...},    // DELIVERY
  items: [{ productId, quantity, addons: [{ addonId }], notes? }],
  couponCode?: string,
  paymentMethod?: 'PIX' | 'CARD' | 'CASH'
}
```

Servidor recalcula preços a partir do cardápio atual (nunca confia em preço enviado pelo cliente) — mesmo padrão de segurança do `ecomerce`.

## KDS (painel de cozinha)

- Lista pedidos em `PREPARING`/`CONFIRMED` agrupados por canal, ordenados por `createdAt`.
- Ação de avançar estado é um botão por pedido (`PREPARING -> READY`), sem edição de itens ali (edição de pedido é outra tela).
- Pensado para rodar em tablet/TV na cozinha — layout fica para a fase de implementação de UI, fora do escopo deste doc de design de dados/protocolo.

## Pendências explícitas para o builder

- Validar se o Next 16 nessa versão específica suporta WebSocket nativo em route handler ou se precisa de servidor Node customizado ao lado (`server.ts` próprio) — decidir na hora da implementação, documentar a escolha real no PR.
- Definir biblioteca exata (`ws` vs `socket.io`) na hora de implementar, com base em suporte a rooms/reconexão automática.
