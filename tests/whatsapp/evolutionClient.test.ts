import { describe, it, expect } from "vitest";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";

describe("fake Evolution client", () => {
  it("records sent messages for assertions", async () => {
    const client = createFakeEvolutionClient();
    await client.sendMessage("5511999999999", "Seu pedido saiu para entrega");
    expect(client.sentMessages).toEqual([{ to: "5511999999999", text: "Seu pedido saiu para entrega" }]);
  });
});
