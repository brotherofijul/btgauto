#!/usr/bin/env node

import { spawn } from "child_process";
import { createApp } from "../src/server/app.js";

const PORT = 7823;

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

const app = createApp();

try {
  await app.listen({ port: PORT, host: "127.0.0.1" });
  const url = `http://localhost:${PORT}`;
  console.log(`🚀 BOIAuto UI → ${url}`);
  openBrowser(url);

  const shutdown = () => app.close().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (err) {
  console.error("Gagal menjalankan server:", err.message);
  process.exit(1);
}
