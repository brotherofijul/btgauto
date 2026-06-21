#!/usr/bin/env node

import { Command } from "commander";
import {
  resolveGameHandler,
  listAvailableGames,
} from "../src/core/gameRegistry.js";

const program = new Command();

program
  .name("btgauto")
  .description("CLI otomatisasi untuk Text-based Game")
  .version("1.0.0")
  .requiredOption(
    "-g, --game <name>",
    "Nama game yang dijalankan (contoh: diplomacia)",
  )
  .requiredOption(
    "-a, --authorization <token>",
    "Bearer token untuk autentikasi",
  )
  .option(
    "-s, --skill <number>",
    "Pilihan skill: 1 (Barak), 2 (Teknik Perang), 3 (Ilmuwan)",
    "3",
  )
  .option("-p, --pay <number>", "Pilihan pembayaran: 1 (Uang), 2 (Berlian)", "1")
  .option("-d, --debug", "Aktifkan mode debug");

program.parse(process.argv);

const options = program.opts();
const gameKey = options.game.toLowerCase();
const handler = resolveGameHandler(gameKey);

if (!handler) {
  console.error(
    `[Error] Game '${options.game}' belum didukung. Tersedia: ${listAvailableGames().join(", ")}`,
  );
  process.exit(1);
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

await handler(options);
