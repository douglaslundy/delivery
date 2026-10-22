import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { createRealtimeServer } from "@/server/realtime";

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url ?? "", true));
  });

  createRealtimeServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
