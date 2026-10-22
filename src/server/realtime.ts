import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { getToken } from "next-auth/jwt";

export type OrderRealtimeEvent = {
  type: "order_status_changed";
  orderId: string;
  status: string;
  channel: string;
  updatedAt: Date;
};

let io: SocketIOServer | null = null;

export function canJoinRoom(room: string, sessionStoreIds: string[]): boolean {
  const parts = room.split(":");

  if (parts[0] !== "store" || parts.length < 3 || parts.length > 4) {
    return false;
  }

  const storeId = parts[1];
  const kind = parts[2];

  if (kind === "kds" || kind === "orders") {
    if (parts.length !== 3) {
      return false;
    }
  } else if (kind === "delivery") {
    if (parts.length !== 4 || !parts[3]) {
      return false;
    }
  } else {
    return false;
  }

  return sessionStoreIds.includes(storeId);
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }

  for (const pair of header.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
}

export function broadcast(room: string, event: OrderRealtimeEvent): void {
  io?.to(room).emit("order_status_changed", event);
}

export class RealtimeServer {
  joinRoom(socketId: string, room: string, sessionStoreIds: string[]): boolean {
    if (!canJoinRoom(room, sessionStoreIds)) {
      return false;
    }

    io?.sockets.sockets.get(socketId)?.join(room);
    return true;
  }

  broadcast(room: string, event: OrderRealtimeEvent): void {
    broadcast(room, event);
  }
}

export function createRealtimeServer(httpServer: HTTPServer): RealtimeServer {
  io = new SocketIOServer(httpServer);
  const server = new RealtimeServer();

  io.use(async (socket, next) => {
    const cookies = parseCookieHeader(socket.request.headers.cookie);
    const token = await getToken({ req: { cookies, headers: socket.request.headers } as never });
    socket.data.availableStoreIds = (token as unknown as { availableStoreIds?: string[] })?.availableStoreIds ?? [];
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => {
      server.joinRoom(socket.id, room, socket.data.availableStoreIds ?? []);
    });
  });

  return server;
}
