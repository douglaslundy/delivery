# Delivery Platform — Design 05: Onboarding, Infra, Deploy, Pendências

Parte 5 de 5 (última).

## Onboarding guiado (8 passos, do documento de requisitos)

```prisma
model StoreOnboardingProgress {
  id          String   @id @default(cuid())
  storeId     String   @unique
  step1EstablishmentDone Boolean @default(false)
  step2PaymentDone       Boolean @default(false)
  step3HoursDone         Boolean @default(false)
  step4DeliveryAreaDone  Boolean @default(false)
  step5BotDone           Boolean @default(false)
  step6DeliveryTimeDone  Boolean @default(false)
  step7SalaoStructureDone Boolean @default(false)
  step8ReviewDone        Boolean @default(false)
  completedAt DateTime?

  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
}
```

Passos (ordem observada no sistema original):
1. Estabelecimento (nome, endereço, categoria de comida).
2. Pagamento online/offline (chave Pix / credenciais Mercado Pago, métodos aceitos).
3. Horário de funcionamento.
4. Área de entrega (cria as primeiras `DeliveryZone`).
5. Bot (conectar instância Evolution API da loja).
6. Tempo de entrega estimado (usado na comunicação com cliente, não é SLA rígido no V1).
7. Estrutura/operação do salão (quantas mesas, se usa PDV).
8. Revisão final → marca `completedAt`, libera o dashboard completo.

Onboarding é guiado mas não bloqueante: loja pode operar com passos incompletos (exceto passo 1, que é pré-requisito pra existir a `Store`).

## Impressão local

- Mesmo protocolo observado no Anota AI original: agente desktop do lojista expõe `http://127.0.0.1:5000/print`.
- Frontend do dashboard (rodando no navegador do lojista) faz o POST direto pra esse endpoint local quando precisa imprimir um pedido/comanda — o backend da plataforma nunca tenta acessar a impressora (está atrás do NAT do lojista, inacessível pela internet).
- Payload exato do agente (`POST /print`) não foi verificado no sistema original — desenhar um contrato simples na implementação (ex.: `{ templateId, data }` ou texto pré-formatado) e documentar a decisão real no PR quando o builder implementar essa fatia. Se o cliente já tiver um agente de impressão específico, adaptar o payload ao que ele espera em vez de inventar um novo.

## Setup de repo (pendência explícita, resolver antes do primeiro commit)

**Problema encontrado:** `C:\Users\dougl\workspace\delivery` está vazio e não é um repo git próprio. O `.git` existente fica na pasta pai `C:\Users\dougl\workspace\` e pertence ao projeto `sysdoc_front` (remote `github.com/douglaslundy/sysdoc_front.git`), com histórico e arquivos completamente não relacionados.

**Opções (usuário ainda não escolheu — perguntar antes de commitar qualquer coisa deste projeto):**
1. `git init` dentro de `workspace\delivery`, criando um repo próprio e independente.
2. Repo remoto já existe no GitHub — clonar para dentro de `workspace\delivery`.
3. Outra estrutura que o usuário prefira.

**Nunca**: rodar `git add`/`git commit` na raiz `workspace\` pensando que é deste projeto — isso commitaria no repo do `sysdoc_front`.

## Infra/deploy

- VPS: `192.168.0.233` (mesma máquina física do `ecomerce`/outros projetos, mas containers e banco **totalmente separados** — serviço Docker Compose próprio deste projeto, rede/volume/porta própria, nunca reutilizando `ecomerce-loja-db-1` nem qualquer container de outro projeto).
- Padrão de `docker-compose.yml` sugerido (reaproveitando o padrão do ecomerce, não o arquivo): serviços `app` (Next), `db` (Postgres), `cron` (jobs: recuperador de vendas, lembretes de conta a pagar), `backup` (dump periódico), proxy (`caddy` ou equivalente) para TLS + subdomínio wildcard.
- `DATABASE_URL` e credenciais de Evolution/Mercado Pago seguem o padrão de criptografia (`CREDENTIALS_KEY`, AES-256-GCM) já usado no ecomerce para dados sensíveis por tenant.
- Nenhum deploy real foi feito ainda — isso é trabalho da fase de implementação, não deste documento de design.

## Pendências explícitas para o plano de implementação (`superpowers:writing-plans`)

- Escolher `ws` vs `socket.io` na hora de montar o realtime (doc 02).
- Validar suporte a WebSocket nativo no Next 16 ou decidir por servidor custom.
- Resolver estrutura de repo (seção acima) antes do primeiro commit de código.
- Receber credenciais da Evolution API do usuário antes de implementar o módulo de WhatsApp.
- Payload exato do agente de impressão local — decidir/documentar na implementação.
- Validar se `OrderStatus` único (doc 02) realmente cobre todos os casos reais ao implementar PDV/SALAO/DELIVERY/AGENDADO; se não cobrir, essa é uma "chamada do builder" a ser registrada no PR, não uma reabertura silenciosa do design.

## Próximo passo

Depois de aprovado, usar `superpowers:writing-plans` para transformar esta spec (5 documentos) num plano de implementação em lotes, seguindo a regra de persistir `STATE.md` por lote dentro do repo deste projeto assim que ele existir.
