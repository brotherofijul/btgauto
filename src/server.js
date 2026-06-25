// src/server.js
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { resolveGameRunner } from "./lib/registry.js";
import { resolveUpgradePayload } from "./games/diplomacia/validator.js";
import { postJson } from "./lib/http-client.js";
import { API_CANCEL } from "./games/diplomacia/config.js";

const SLOT_COUNT = 2;
const LOG_CACHE_MAX = 20;

const __dirname = dirname(fileURLToPath(import.meta.url));

function createSlot() {
  return {
    abortController: null,
    running: false,
    activeSkill: null,
    token: null,
    cache: { pendingAt: null, currentLevel: null, targetLevel: null, skill: null },
  };
}

const slots = Object.fromEntries(
  Array.from({ length: SLOT_COUNT }, (_, i) => [i + 1, createSlot()]),
);

const clients = new Set();
let nextLogId = 0;
const logCache = [];

function pushLogCache(entry) {
  entry._id = ++nextLogId;
  entry.time = new Date().toTimeString().slice(0, 8);
  logCache.push(entry);
  if (logCache.length > LOG_CACHE_MAX) logCache.shift();
}

function broadcast(message) {
  const raw = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

function snapshotStatus() {
  const out = {};
  for (let i = 1; i <= SLOT_COUNT; i++) {
    out[i] = { running: slots[i].running };
  }
  return out;
}

function snapshotCache() {
  const out = {};
  for (let i = 1; i <= SLOT_COUNT; i++) {
    out[i] = { ...slots[i].cache };
  }
  return out;
}

export function createApp() {
  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);

  app.register(async function (fastify) {
    fastify.get("/ws", { websocket: true }, (socket) => {
      clients.add(socket);

      socket.send(
        JSON.stringify({
          type: "init",
          status: snapshotStatus(),
          cache: snapshotCache(),
          logs: logCache,
          lastLogId: nextLogId,
        }),
      );

      socket.on("message", async (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (msg.action === "sync") {
          socket.send(
            JSON.stringify({
              type: "sync",
              status: snapshotStatus(),
              cache: snapshotCache(),
              logs: logCache,
              lastLogId: nextLogId,
            }),
          );
          return;
        }

        const n = Number(msg.slot);
        if (n < 1 || n > SLOT_COUNT) {
          return sendError(socket, n, "Slot tidak valid.");
        }

        if (msg.action === "start") {
          handleStart(socket, n, msg);
        } else if (msg.action === "stop") {
          await handleStop(socket, n);
        } else if (msg.action === "status") {
          socket.send(
            JSON.stringify({ type: "status", slots: snapshotStatus() }),
          );
        }
      });

      socket.on("close", () => clients.delete(socket));
    });
  });

  app.register(fastifyStatic, {
    root: join(__dirname, "views"),
    prefix: "/",
  });

  return app;
}

function handleStart(socket, n, msg) {
  const slot = slots[n];
  if (slot.running) {
    return sendError(socket, n, "Loop sudah berjalan.");
  }

  const { game, authorization, skill = "3", pay = "1" } = msg;
  if (!game || !authorization) {
    return sendError(socket, n, "Field 'game' dan 'authorization' wajib diisi.");
  }

  const runner = resolveGameRunner(game.toLowerCase());
  if (!runner) {
    return sendError(socket, n, `Game '${game}' tidak didukung.`);
  }

  let payload;
  try {
    payload = resolveUpgradePayload({ skill, pay });
  } catch (err) {
    return sendError(socket, n, err.message);
  }

  slot.abortController = new AbortController();
  slot.running = true;
  slot.activeSkill = payload.skill;
  slot.token = authorization;
  broadcast({ type: "status", slots: snapshotStatus() });

  const onLog = (event) => {
    const { type: logType, skill: evSkill, ...rest } = event;
    if (evSkill) slot.activeSkill = evSkill;

    if (rest.pendingAt) slot.cache.pendingAt = rest.pendingAt;
    if (rest.currentLevel != null) slot.cache.currentLevel = rest.currentLevel;
    if (rest.targetLevel != null) slot.cache.targetLevel = rest.targetLevel;
    if (evSkill) slot.cache.skill = evSkill;

    const entry = { type: "log", slot: n, logType, skill: evSkill, ...rest };
    pushLogCache(entry);
    broadcast(entry);
  };

  runner({
    token: authorization,
    payload,
    signal: slot.abortController.signal,
    onLog,
  }).finally(() => {
    slot.abortController = null;
    slot.running = false;
    slot.activeSkill = null;
    slot.token = null;
    slot.cache = { pendingAt: null, currentLevel: null, targetLevel: null, skill: null };
    broadcast({ type: "stopped", slot: n, text: "Loop dihentikan." });
    broadcast({ type: "status", slots: snapshotStatus() });
  });
}

async function handleStop(socket, n) {
  const slot = slots[n];
  if (!slot.running) {
    return sendError(socket, n, "Loop tidak sedang berjalan.");
  }

  if (slot.activeSkill && slot.token) {
    try {
      const cancelSignal = AbortSignal.timeout(5000);
      const { body: res } = await postJson(
        API_CANCEL,
        { skill: slot.activeSkill },
        slot.token,
        cancelSignal,
      );

      if (res?.success) {
        const entry = {
          type: "log",
          slot: n,
          logType: "info",
          skill: res.skill,
          text: `Upgrade ${res.skill} dibatalkan.`,
        };
        pushLogCache(entry);
        broadcast(entry);
      } else {
        const entry = {
          type: "log",
          slot: n,
          logType: "warn",
          text: "Gagal membatalkan upgrade di server.",
        };
        pushLogCache(entry);
        broadcast(entry);
      }
    } catch (err) {
      const entry = {
        type: "log",
        slot: n,
        logType: "warn",
        text: `Cancel error: ${err.message}`,
      };
      pushLogCache(entry);
      broadcast(entry);
    }
  }

  slot.abortController.abort();
}

function sendError(socket, slot, text) {
  socket.send(JSON.stringify({ type: "error", slot, text }));
}