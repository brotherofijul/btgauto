#!/usr/bin/env node
// bin/index.js
import { Command } from "commander";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { createApp } from "../src/server.js";

const program = new Command();

program
  .name("btgauto")
  .description("Text-based game automation")
  .option("-h, --host <host>", "Host to bind", "localhost")
  .option("-p, --port <port>", "Port to listen", "7823")
  .option("-d, --debug", "Enable debug logging", false)
  .parse();

const { host, port, debug } = program.opts();
const PORT = parseInt(port, 10);

if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  process.stderr.write(`Error: Port "${port}" is invalid.\n`);
  process.exit(1);
}

const streams = [
  {
    level: debug ? "debug" : "info",
    stream: pinoPretty({
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    }),
  },
];

if (!debug) {
  streams.push({ level: "debug", stream: process.stderr });
}

const logger = pino(
  { level: debug ? "debug" : "info" },
  pino.multistream(streams),
);

const app = createApp(logger);

try {
  await app.listen({ port: PORT, host });
  logger.info(`BOIAuto \u2192 http://${host}:${PORT}`);

  const shutdown = async () => {
    logger.info("Shutting down...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (err) {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
}