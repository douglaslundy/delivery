import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/crypto";

type EvolutionResult = { ok: true; data: unknown } | { ok: false; status: number; error: string };

export async function callEvolutionRaw(
  url: string,
  apiKey: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<EvolutionResult> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      method: init.method ?? "GET",
      headers: { apikey: apiKey, "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: 502, error: `Evolution respondeu ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch (error) {
    return { ok: false, status: 502, error: `Falha ao falar com a Evolution: ${error instanceof Error ? error.message : "erro"}` };
  }
}

// Usa a apiKey guardada no servidor; ela nunca volta ao browser.
export async function callEvolution(
  storeId: string,
  path: (instanceName: string) => string,
  init: { method?: string; body?: unknown } = {},
): Promise<EvolutionResult> {
  const instance = await prisma.whatsappInstance.findUnique({ where: { storeId } });
  if (!instance) return { ok: false, status: 404, error: "instancia nao configurada" };
  return callEvolutionRaw(instance.evolutionApiUrl, decryptCredential(instance.apiKeyEncrypted), path(instance.evolutionInstanceName), init);
}
