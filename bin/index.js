#!/usr/bin/env node

import { spawn } from "child_process";
import { parseArgs } from "util";
import { createApp } from "../src/server/app.js";

const options = {
  host: { type: "string", default: "127.0.0.1" },
  port: { type: "string", default: "7823" },
};

const { values } = parseArgs({ options, allowPositionals: false });

const HOST = values.host;
const PORT = parseInt(values.port, 10);

// Validasi port untuk mencegah error runtime Fastify/Express
if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Error: Port "${values.port}" tidak valid.`);
  process.exit(1);
}

function openBrowser(url) {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const cmd = isWin ? "cmd" : isMac ? "open" : "xdg-open";
  const args = isWin ? ["/c", "start", url] : [url];

  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

const app = createApp();

try {
  // Menggunakan HOST dan PORT hasil parsing argumen
  await app.listen({ port: PORT, host: HOST });

  // Jika host diatur ke 0.0.0.0 (untuk NAT VPS), browser lokal tetap dibuka ke localhost
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const url = `http://${displayHost}:${PORT}`;

  console.log(`🚀 BOIAuto UI → http://${HOST}:${PORT}`);
  console.log(`🌐 Membuka browser ke → ${url}`);
  openBrowser(url);

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
