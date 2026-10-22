import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/webhooks/evolution/route";

describe("evolution webhook", () => {
  it("rejects a payload from an unknown instance", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ evolutionInstanceName: "desconhecida", from: "551199999999", text: "oi" }) }));
    expect(res.status).toBe(404);
  });
});
