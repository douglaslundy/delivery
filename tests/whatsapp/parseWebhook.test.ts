import { describe, it, expect } from "vitest";
import { parseIncomingWebhook } from "@/lib/whatsapp/parseWebhook";

const native = (over: Record<string, unknown> = {}, key: Record<string, unknown> = {}) => ({
  event: "messages.upsert",
  instance: "loja",
  apikey: "k-body",
  data: { key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false, ...key }, message: { conversation: "oi" }, ...over },
});

describe("parseIncomingWebhook", () => {
  it("keeps the legacy format working", () => {
    expect(parseIncomingWebhook({ evolutionInstanceName: "a", from: "55", text: "x" }, "h")).toEqual({ instanceName: "a", from: "55", text: "x", apiKey: "h" });
  });

  it("parses a native MESSAGES_UPSERT conversation, using body apikey as fallback", () => {
    expect(parseIncomingWebhook(native(), null)).toEqual({ instanceName: "loja", from: "5511999990000", text: "oi", apiKey: "k-body" });
  });

  it("prefers the header apikey and reads extendedTextMessage", () => {
    const r = parseIncomingWebhook(native({ message: { extendedTextMessage: { text: "ola" } } }), "k-header");
    expect(r).toMatchObject({ text: "ola", apiKey: "k-header" });
  });

  it("ignores own messages, groups, other events and non-text", () => {
    expect(parseIncomingWebhook(native({}, { fromMe: true }), null)).toBeNull();
    expect(parseIncomingWebhook(native({}, { remoteJid: "1203@g.us" }), null)).toBeNull();
    expect(parseIncomingWebhook({ ...native(), event: "connection.update" }, null)).toBeNull();
    expect(parseIncomingWebhook(native({ message: { imageMessage: {} } }), null)).toBeNull();
    expect(parseIncomingWebhook(null, null)).toBeNull();
  });
});
