"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Progress = {
  step1EstablishmentDone: boolean;
  step2PaymentDone: boolean;
  step3HoursDone: boolean;
  step4DeliveryAreaDone: boolean;
  step5BotDone: boolean;
  step6DeliveryTimeDone: boolean;
  step7SalaoStructureDone: boolean;
  step8ReviewDone: boolean;
} | null;

const STEPS: { key: keyof NonNullable<Progress>; label: string; href: string }[] = [
  { key: "step1EstablishmentDone", label: "Estabelecimento", href: "./menu" },
  { key: "step2PaymentDone", label: "Pagamento", href: "./financeiro" },
  { key: "step3HoursDone", label: "Horario de funcionamento", href: "./settings" },
  { key: "step4DeliveryAreaDone", label: "Area de entrega", href: "./entregas" },
  { key: "step5BotDone", label: "Bot (WhatsApp)", href: "./marketing" },
  { key: "step6DeliveryTimeDone", label: "Tempo de entrega estimado", href: "./settings" },
  { key: "step7SalaoStructureDone", label: "Estrutura do salao", href: "./settings" },
];

export default function OnboardingPage() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;
  const [progress, setProgress] = useState<Progress>(null);

  function reload() {
    fetch(`/api/stores/${storeId}/onboarding`)
      .then((res) => res.json())
      .then(setProgress);
  }

  useEffect(reload, [storeId]);

  async function finishReview() {
    await fetch(`/api/stores/${storeId}/onboarding/complete-review`, { method: "POST" });
    reload();
  }

  return (
    <main>
      <h1>Onboarding</h1>
      <p>Cada passo fica concluido automaticamente ao usar a tela real correspondente. Nenhum passo bloqueia o uso do painel, exceto o primeiro (criacao da loja).</p>
      <ol>
        {STEPS.map((step) => (
          <li key={step.key}>
            {progress?.[step.key] ? "✓" : "○"} <a href={step.href}>{step.label}</a>
          </li>
        ))}
        <li>
          {progress?.step8ReviewDone ? "✓" : "○"} Revisao final{" "}
          {!progress?.step8ReviewDone && <button onClick={finishReview}>Concluir revisao</button>}
        </li>
      </ol>
    </main>
  );
}
