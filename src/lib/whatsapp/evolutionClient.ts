import type { WhatsappInstance } from "@prisma/client";
import { decryptCredential } from "@/lib/crypto";

export interface EvolutionClient {
  sendMessage(to: string, text: string): Promise<void>;
}

export function createEvolutionClient(instance: WhatsappInstance): EvolutionClient {
  return {
    async sendMessage(to, text) {
      // Exact Evolution API path/payload shape is unverified without real credentials
      // (spec 00/04 pendency) — confirm against the real instance once credentials arrive.
      await fetch(`${instance.evolutionApiUrl}/message/sendText/${instance.evolutionInstanceName}`, {
        method: "POST",
        headers: { apikey: decryptCredential(instance.apiKeyEncrypted), "content-type": "application/json" },
        body: JSON.stringify({ number: to, text }),
      });
      if (!res.ok) throw new Error(`Evolution sendText falhou: HTTP ${res.status}`);
    },
  };
}

export function createFakeEvolutionClient(): EvolutionClient & { sentMessages: { to: string; text: string }[] } {
  const sentMessages: { to: string; text: string }[] = [];
  return {
    sentMessages,
    async sendMessage(to, text) {
      sentMessages.push({ to, text });
    },
  };
}
