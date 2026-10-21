# Delivery Platform — Design 04: Marketing, Atendimento, Entregas

Parte 4 de 5.

## Marketing/retenção

```prisma
model Coupon {
  id            String   @id @default(cuid())
  storeId       String
  code          String
  kind          String   // 'PERCENT' | 'FIXED'
  value         Int      // percentual (0-100) ou centavos, conforme kind
  active        Boolean  @default(true)
  expiresAt     DateTime?
  usageLimit    Int?
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId, code])
  @@index([storeId])
}

model CashbackLedger {
  id          String   @id @default(cuid())
  storeId     String
  customerId  String
  orderId     String?  // null = ajuste manual
  amountCents Int       // positivo = crédito, negativo = uso/débito
  createdAt   DateTime @default(now())

  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId, customerId])
}

model LoyaltyProgram {
  id               String  @id @default(cuid())
  storeId          String
  pointsPerCurrencyUnit Int @default(1) // ex.: 1 ponto por R$1 gasto
  redemptionRuleCents   Int             // ex.: 100 pontos = X centavos de desconto
  active           Boolean @default(true)
  store            Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId])
}
```

- **Recuperador de vendas**: não é uma tabela nova — é um job/relatório que lê `Order` + `Customer` e identifica quem não compra há N dias, disparando mensagem via Evolution API (ver seção WhatsApp abaixo). Lógica de job, não de schema.

## Atendimento

```prisma
model CustomerFeedback {
  id        String   @id @default(cuid())
  storeId   String
  orderId   String?
  rating    Int      // 1-5
  comment   String?
  createdAt DateTime @default(now())

  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}

model SupportTicket {
  id          String   @id @default(cuid())
  storeId     String
  customerId  String?
  subject     String
  status      String   // 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?

  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId, status])
}
```

## Bot de atendimento — Evolution API (WhatsApp)

- **Decisão:** Evolution API self-hosted (não é a API oficial da Meta) — já roda em ambiente do próprio usuário, fora desta VPS. Credenciais (URL da instância + API key) serão fornecidas depois; não inventar endpoint até receber.
- **Uma instância Evolution por loja (tenant)**: cada restaurante conecta seu próprio número de WhatsApp. Isolamento multi-tenant também no WhatsApp, não só no banco/realtime.

```prisma
model WhatsappInstance {
  id           String   @id @default(cuid())
  storeId      String
  evolutionInstanceName String  // nome da instância na Evolution API
  evolutionApiUrl       String  // base URL dessa instância (pode variar por loja)
  apiKeyEncrypted       String  // igual ao padrão CREDENTIALS_KEY (AES-256-GCM) do ecomerce
  phoneNumber  String?
  connected    Boolean  @default(false)
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId])
}
```

- Fluxo básico V1: webhook da Evolution API recebe mensagem → backend identifica `storeId` pela instância de origem → responde com status de pedido quando o cliente pergunta (ex. "onde está meu pedido"), ou dispara notificação automática em mudança de `OrderStatus` (ex. "seu pedido saiu para entrega").
- Bot "básico" = respostas automáticas por palavra-chave/estado do pedido, não um LLM conversacional completo no V1 (reavaliar depois se o cliente pedir).

## Entregas

```prisma
model DeliveryPerson {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  phone     String
  active    Boolean  @default(true)
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}

model DeliveryZone {
  id            String   @id @default(cuid())
  storeId       String
  name          String
  feeCents      Int
  // V1: área simples por nome/bairro + taxa fixa. Polígono geográfico fica para V2 se o cliente pedir.
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}
```

- `Order.deliveryId` (doc 01) referencia `DeliveryPerson.id` quando designado.
- Rastreamento no V1 é por status (`OUT_FOR_DELIVERY` → `DELIVERED`), sem geolocalização em tempo real do entregador — isso ficaria para uma v2 com app mobile do entregador, fora de escopo agora.
