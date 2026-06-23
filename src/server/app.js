import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { apiRoutes } from "./routes/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(__dirname, "views/index.html"), "utf-8");

export function createApp() {
  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);
  app.get("/", (_, reply) => reply.type("text/html").send(indexHtml));
  app.register(apiRoutes);
  return app;
}
