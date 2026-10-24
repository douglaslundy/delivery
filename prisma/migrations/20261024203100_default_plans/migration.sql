-- Planos padrao; ids fixos para os seeds serem idempotentes.
INSERT INTO "Plan" ("id","name","description","priceCents","active","maxOrdersPerMonth","maxProducts","maxCustomers","maxCategories","maxMembers","maxDeliveryPeople","features")
VALUES
 ('plan_basico','Básico','Para começar: cardápio e pedidos',4900,true,300,50,500,10,2,3,'{"whatsappBot":false,"pdv":true,"tables":false,"finance":false,"marketing":false,"fiscal":false,"delivery":true}'),
 ('plan_profissional','Profissional','Loja em crescimento com bot, financeiro e marketing',9900,true,2000,300,5000,40,10,15,'{"whatsappBot":true,"pdv":true,"tables":true,"finance":true,"marketing":true,"fiscal":false,"delivery":true}'),
 ('plan_ilimitado','Ilimitado','Sem limites e todos os recursos',19900,true,NULL,NULL,NULL,NULL,NULL,NULL,'{"whatsappBot":true,"pdv":true,"tables":true,"finance":true,"marketing":true,"fiscal":true,"delivery":true}')
ON CONFLICT ("id") DO NOTHING;
