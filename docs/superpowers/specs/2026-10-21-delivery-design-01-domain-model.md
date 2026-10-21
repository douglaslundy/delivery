# Delivery Platform — Design 01: Modelo de domínio (Prisma)

Parte 1 de 5. Ver `00-overview.md` para contexto/decisões gerais.

## Multi-tenant e auth

- `Store`: uma linha por restaurante/tenant. Campos: `id`, `slug` (subdomínio), `name`, `active`, `createdAt`, timezone/moeda se necessário.
- `StoreDomain`: opcional, para domínio próprio futuro (reservado, não implementado no V1 alem do campo).
- `Account` / `StoreMember`: usuário da plataforma e seu vínculo com uma ou mais stores + role (`OWNER`, `MANAGER`, `ATTENDANT`, `KITCHEN`, `DELIVERY`). Reaproveita o padrão de role-per-store do ecomerce, não o código.
- next-auth v4, credentials provider (e-mail/senha) como no ecomerce; sessão carrega `storeId` ativo quando o usuário pertence a uma única loja, ou exige seleção quando pertence a mais de uma.
- Toda tabela de negócio carrega `storeId` e usa índice/constraint composta `(storeId, id)` nas FKs entre si, igual ao padrão do ecomerce — evita vazamento cross-tenant.

## Cardápio

```prisma
model Category {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  position  Int      @default(0)
  active    Boolean  @default(true)
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  products  Product[]

  @@unique([storeId, id])
  @@index([storeId])
}

model Product {
  id           String   @id @default(cuid())
  storeId      String
  categoryId   String?
  name         String
  description  String   @default("")
  descriptionAiSuggested String? // sugestão de descrição gerada por IA, editável
  photoUrl     String?
  priceCents   Int?     // preço fixo
  pricePerKg   Boolean  @default(false)
  active       Boolean  @default(true)
  position     Int      @default(0)
  createdAt    DateTime @default(now())

  store        Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  category     Category?     @relation(fields: [storeId, categoryId], references: [storeId, id])
  addons       ProductAddon[]
  classifications ProductClassification[]

  @@unique([storeId, id])
  @@index([storeId])
  @@index([categoryId])
}

/// Classificação livre do item (ex.: vegano, picante, sem lactose) — tags simples, não confundir com adicional.
model ProductClassification {
  id        String  @id @default(cuid())
  storeId   String
  productId String
  label     String
  store     Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [storeId, productId], references: [storeId, id], onDelete: Cascade)

  @@index([storeId])
  @@index([productId])
}

/// Adicional de item (ex.: borda, molho, tamanho). Grupo com nome, obrigatório/opcional, escolha única/múltipla.
model ProductAddon {
  id         String  @id @default(cuid())
  storeId    String
  productId  String
  groupName  String
  name       String
  priceCents Int     @default(0)
  required   Boolean @default(false)
  multiple   Boolean @default(false)
  active     Boolean @default(true)
  position   Int     @default(0)

  store      Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  product    Product @relation(fields: [storeId, productId], references: [storeId, id], onDelete: Cascade)

  @@index([storeId])
  @@index([productId])
}
```

**Nota do builder:** não existe `Variant` aqui (isso é específico do domínio de loja de roupas no `ecomerce`, não se aplica a cardápio). `ProductAddon` é o equivalente para extras de cardápio.

## Pedidos (ver `02-order-flow-realtime.md` para a máquina de estados completa)

```prisma
enum OrderChannel {
  PDV
  SALAO
  DELIVERY
  AGENDADO
}

enum OrderStatus {
  RECEIVED
  CONFIRMED
  PREPARING
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  COMPLETED
  CANCELED
}

model Order {
  id             String       @id @default(cuid())
  storeId        String
  customerId     String?
  channel        OrderChannel
  status         OrderStatus  @default(RECEIVED)
  tableNumber    String?      // só para SALAO
  scheduledFor   DateTime?    // só para AGENDADO
  deliveryAddress Json?       // snapshot do endereço no momento do pedido, só para DELIVERY
  deliveryId     String?      // entregador designado, ver 04
  subtotalCents  Int
  discountCents  Int          @default(0)
  deliveryFeeCents Int        @default(0)
  totalCents     Int
  paymentMethod  String?      // 'PIX' | 'CARD' | 'CASH' | ...
  mpPaymentId    String?
  couponId       String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  store          Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  items          OrderItem[]
  statusHistory  OrderStatusEvent[]

  @@unique([storeId, id])
  @@index([storeId, status])
}

model OrderItem {
  id          String  @id @default(cuid())
  storeId     String
  orderId     String
  productId   String
  quantity    Int
  unitPriceCents Int
  weightGrams Int?    // só quando o produto é por kg
  addons      Json    // snapshot dos adicionais escolhidos (nome + preço no momento do pedido)
  notes       String?

  order       Order   @relation(fields: [storeId, orderId], references: [storeId, id], onDelete: Cascade)

  @@index([storeId])
  @@index([orderId])
}

/// Histórico de transição de status — base do canal realtime/KDS (doc 02).
model OrderStatusEvent {
  id        String      @id @default(cuid())
  storeId   String
  orderId   String
  status    OrderStatus
  createdAt DateTime    @default(now())
  actorId   String?     // quem mudou (null = sistema/automação)

  order     Order       @relation(fields: [storeId, orderId], references: [storeId, id], onDelete: Cascade)

  @@index([orderId])
}
```

**Decisão de design:** `OrderStatus` único cobre pagamento + cozinha + entrega como uma máquina de estados linear (ver doc 02), em vez de dois enums separados (`PaymentStatus` + `KitchenStatus`) como foi rascunhado erroneamente na tentativa anterior sobre o `ecomerce`. Mais simples de implementar e de exibir no KDS; reavaliar só se o builder encontrar um caso real que não caiba numa única linha de estados.

## Financeiro (completo — ver `03-financeiro-fiscal.md` para fluxos)

```prisma
model FinanceCategory {
  id      String @id @default(cuid())
  storeId String
  name    String
  kind    String // 'INCOME' | 'EXPENSE'
  store   Store  @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}

model BankAccount {
  id            String  @id @default(cuid())
  storeId       String
  name          String
  initialBalanceCents Int @default(0)
  store         Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}

model FinanceEntry {
  id            String   @id @default(cuid())
  storeId       String
  bankAccountId String?
  categoryId    String?
  orderId       String?   // vínculo opcional com o pedido que originou a entrada
  kind          String    // 'INCOME' | 'EXPENSE'
  amountCents   Int
  dueDate       DateTime?
  paidAt        DateTime?
  description   String
  createdAt     DateTime  @default(now())

  store         Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId, dueDate])
  @@index([storeId, paidAt])
}
```

## Fiscal (reserva de schema, sem implementação)

```prisma
model FiscalDocument {
  id          String   @id @default(cuid())
  storeId     String
  orderId     String
  kind        String   // 'NFCE' (único valor usado no V1, campo livre para futuro NFE/NFSE)
  status      String   // 'PENDING' | 'ISSUED' | 'ERROR' | 'CANCELED' (placeholder)
  providerRef String?  // id na SEFAZ/motor de emissão, quando existir
  issuedAt    DateTime?
  createdAt   DateTime @default(now())

  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
  @@index([orderId])
}
```

Nenhuma lógica de emissão no V1 — tabela existe só para não quebrar schema quando o módulo fiscal for implementado (usar skill `br-fiscal-note-emission` nessa hora).

## Marketing/atendimento/entregas

Ver `04-marketing-atendimento-entregas.md` para os models `Coupon`, `CashbackLedger`, `LoyaltyProgram`, `WhatsappInstance`, `CustomerFeedback`, `SupportTicket`, `DeliveryPerson`, `DeliveryZone`.

## Onboarding

Ver `05-onboarding-infra-deploy.md` para o model `StoreOnboardingProgress` e os 8 passos.
