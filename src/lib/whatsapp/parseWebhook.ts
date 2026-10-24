export type IncomingMessage = { instanceName: string; from: string; text: string; apiKey: string | null };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

// Aceita o formato simples {evolutionInstanceName, from, text} e o nativo da
// Evolution v2 (MESSAGES_UPSERT). Devolve null para o que deve ser ignorado
// (mensagem propria, grupo, evento que nao e mensagem de texto).
export function parseIncomingWebhook(body: unknown, headerKey: string | null): IncomingMessage | null {
  const b = obj(body);

  if (str(b.evolutionInstanceName) && str(b.from)) {
    return { instanceName: b.evolutionInstanceName as string, from: b.from as string, text: str(b.text) ?? "", apiKey: headerKey };
  }

  const event = str(b.event);
  if (event && event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;

  const instanceName = str(b.instance);
  const data = obj(b.data);
  const key = obj(data.key);
  const remoteJid = str(key.remoteJid);
  if (!instanceName || !remoteJid || key.fromMe === true || remoteJid.endsWith("@g.us")) return null;

  const message = obj(data.message);
  const text = str(message.conversation) ?? str(obj(message.extendedTextMessage).text);
  if (!text) return null;

  return { instanceName, from: remoteJid.split("@")[0], text, apiKey: headerKey ?? str(b.apikey) };
}
