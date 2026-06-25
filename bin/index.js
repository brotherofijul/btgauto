#!/usr/bin/env node
// bin/index.js
import { Command } from "commander";
import { createApp } from "../src/server.js";

const program = new Command();

program
  .name("btgauto")
  .description("Text-based game automation")
  .option("--host <host>", "Host to bind", "localhost")
  .option("--port <port>", "Port to listen", "7823")
  .parse();

const { host, port } = program.opts();
const PORT = parseInt(port, 10);

if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Error: Port "${port}" tidak valid.`);
  process.exit(1);
}

const app = createApp();

try {
  await app.listen({ port: PORT, host });
  console.log(`BOIAuto → http://${host}:${PORT}`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (err) {
  console.error("Gagal menjalankan server:", err.message);
  process.exit(1);
}