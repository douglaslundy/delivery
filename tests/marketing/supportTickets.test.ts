import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getTicket, PATCH as patchTicket } from "@/app/api/stores/[storeId]/support-tickets/[ticketId]/route";

describe("support tickets cross-tenant isolation", () => {
  let storeA: string, storeB: string, ticketId: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "ticket-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "ticket-b", name: "B" } })).id;
    ticketId = (await prisma.supportTicket.create({ data: { storeId: storeB, subject: "Problema", status: "OPEN" } })).id;
  });
  afterEach(async () => { await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("404s when fetching another store's ticket", async () => {
    const res = await getTicket(
      new Request("http://x", hostFor("ticket-a")),
      { params: Promise.resolve({ storeId: storeA, ticketId }) } as any,
    );
    expect(res.status).toBe(404);
  });

  it("404s when patching another store's ticket, and leaves it unchanged", async () => {
    const res = await patchTicket(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "CLOSED" }), ...hostFor("ticket-a") }),
      { params: Promise.resolve({ storeId: storeA, ticketId }) } as any,
    );
    expect(res.status).toBe(404);

    const ticket = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe("OPEN");
  });
});
