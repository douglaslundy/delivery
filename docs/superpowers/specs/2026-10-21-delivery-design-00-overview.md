# Delivery Platform — Design 00: Overview

Status: aprovado em brainstorming (2026-10-21). Documento dividido em partes por limite de janela de contexto — ver índice no final.

## Intent

SaaS multi-tenant de gestão para restaurante/delivery, clone funcional do Anota AI (`admin.anota.ai`), para um cliente real já em negociação. Projeto **independente** do SaaS `ecomerce` (loja de roupas) — repo, banco e domínio de negócio próprios. Não compartilha instância de banco nem deploy com o `ecomerce`, mesmo que inicialmente hospedado na mesma VPS física (containers/banco isolados).

## Why

Produto vai para um cliente real que já está esperando. Requisitos já foram levantados por engenharia reversa do `admin.anota.ai` (conta real do usuário) — documento publicado: https://claude.ai/artifact/6SS7TRDQJZfFGefdQwuMWe. Usuário decidiu entregar o V1 com o escopo completo do documento de requisitos de uma vez (não fasear), delegando as escolhas técnicas ao assistente.

## Goals (V1 — tudo de uma vez)

- Multi-tenant por subdomínio (`loja.dominio.com`), um deploy serve N restaurantes.
- Cardápio: categorias, itens (preço fixo ou por kg), adicionais (grupos obrigatório/opcional, único/múltiplo), disponibilidade.
- Pedidos: PDV (balcão), salão (mesas), delivery, agendado — com máquina de estados.
- KDS (painel de cozinha) e acompanhamento de pedido em tempo real via WebSocket próprio.
- Financeiro completo: fluxo de caixa diário, contas a pagar/receber, categorias financeiras, conta bancária, relatórios.
- Marketing/retenção: cupom, cashback, fidelidade, recuperador de vendas.
- Atendimento: bot WhatsApp via Evolution API (self-hosted, instância por loja), feedback de clientes, chamado de atendentes.
- Entregas: cadastro de entregador, áreas de entrega, rastreamento.
- Onboarding guiado em 8 passos (estabelecimento, pagamento, horário, área de entrega, bot, tempo de entrega, estrutura/operação do salão).
- Integração com agente de impressão local do lojista (`http://127.0.0.1:5000/print`).
- Pagamento online via Mercado Pago (credenciais próprias deste cliente/tenant).

## Non-goals (V1)

- Emissão fiscal (NFC-e) real — só reserva de campos no schema. Implementação fica para uma fase posterior, usando a skill `br-fiscal-note-emission` quando chegar a hora (regra muda por estado/prefeitura).
- Multi-idioma, app mobile nativo, qualquer integração de delivery de terceiros (Rappi/Uber Eats) — fora de escopo até surgir pedido explícito.

## Anti-goals

- Qualquer acoplamento com o projeto `ecomerce`/loja de roupa: mesmo repo, mesmo banco, mesma instância de app, ou qualquer migration que toque o banco deles. Isso já aconteceu por engano uma vez nesta sessão e foi revertido — não repetir.
- Herdar decisões de schema do `ecomerce` só por "já existir". Este projeto reaproveita o *padrão* (Next+Prisma+multi-tenant por subdomínio), não o código/dados.

## Constraints

- Ambiente de dev: Windows, sem Docker local disponível no momento da decisão (verificar de novo antes de assumir) — testes de integração de banco tendem a rodar direto na VPS de teste.
- VPS de teste: `192.168.0.233` (usuário `lundy` — credenciais fornecidas pelo usuário na sessão, não gravadas em memória/documento; pedir de novo quando precisar). Hospeda outros projetos não relacionados (`ecomerce-loja-*`, `sysdoc`, etc.) — qualquer deploy deste projeto usa containers e banco **próprios**, nunca reutiliza os serviços de outro projeto.
- Evolution API (WhatsApp) já está rodando em ambiente do usuário — credenciais serão fornecidas depois, não inventar endpoint/instância.
- `C:\Users\dougl\workspace\delivery` está vazio e **não tem `.git` próprio** — o repo git da pasta pai `workspace\` pertence ao projeto `sysdoc_front`. Resolver isso antes do primeiro commit deste projeto (ver seção "Setup de repo" no doc 05).

## Decisões de "como construir" (do usuário/assistente, registradas)

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Stack | Next 16 + Prisma 6/Postgres + next-auth v4 | — (reaproveita padrão do ecomerce, não o código) |
| Realtime | WebSocket próprio (Socket.IO/ws) no mesmo app Next | Pusher/Ably (custo recorrente), Firebase RTDB (dependência nova), polling (latência) |
| Multi-tenant | Subdomínio por loja (`loja.dominio.com`) | Domínio próprio desde o início, seletor de loja pós-login |
| Infra | Mesma VPS 192.168.0.233, containers/banco separados | VPS nova dedicada, infra "decidir depois" |
| Pagamento | Mercado Pago | Stripe/PagSeguro, só manual na entrega |
| Fiscal | Schema reservado agora, implementação depois | Implementar NFC-e já no V1 |
| WhatsApp | Evolution API self-hosted, 1 instância por loja | API oficial Meta Cloud, provedor terceirizado pago |
| Evolution infra | Já roda em ambiente existente do usuário (fora desta VPS) | Container novo na mesma VPS |
| Financeiro V1 | Completo (fluxo de caixa + contas a pagar/receber + relatórios + conta bancária) | Só fluxo de caixa diário |
| Entregas V1 | Cadastro de entregador + áreas de entrega, já no V1 | Adiar para V2 |
| Bot WhatsApp V1 | Básico, já no V1 | Adiar para V2 |
| Escopo V1 | Documento de requisitos completo de uma vez | Fasear em núcleo mínimo primeiro |

## Índice dos documentos desta spec

- `00-overview.md` — este arquivo: intenção, goals/non-goals/anti-goals, constraints, decisões de arquitetura.
- `01-domain-model.md` — modelo de dados Prisma completo (Store/Product/Order/financeiro/marketing/entregas/etc.), decisões de multi-tenant e auth.
- `02-order-flow-realtime.md` — máquina de estados de pedido (PDV/salão/delivery/agendado), protocolo do canal WebSocket, eventos do KDS.
- `03-financeiro-fiscal.md` — modelo e fluxos do módulo financeiro completo; reserva de schema fiscal (NFC-e) sem implementação.
- `04-marketing-atendimento-entregas.md` — cupom/cashback/fidelidade/recuperador, bot WhatsApp (Evolution API), feedback/chamados, entregador/áreas de entrega.
- `05-onboarding-infra-deploy.md` — onboarding guiado em 8 passos, impressão local, setup de repo/infra/deploy na VPS, pendências para o builder.

**Builder check:** nenhum subagente de revisão foi disparado para esta spec (decisão consciente, ver nota de economia de tokens do usuário); o próprio autor revisou os 5 documentos em sequência antes de fechar. Qualquer lacuna encontrada durante a implementação deve ser resolvida como "chamada do builder" (marcada como tal no plano de implementação), não suposta em silêncio.
