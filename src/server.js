// src/server.js
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { resolveGameRunner } from "./lib/registry.js";
import { resolveUpgradePayload } from "./games/diplomacia/validator.js";
import { postJson } from "./lib/http-client.js";
import { API_UPGRADE, API_CANCEL } from "./games/diplomacia/config.js";

const SLOT_COUNT = 2;
const LOG_CACHE_MAX = 20;

const SKILL_DISPLAY = {
  kisla: "Barrack",
  savas_teknikleri: "War Technique",
  bilim_insani: "Scientist",
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function createSlot() {
  return {
    abortController: null,
    running: false,
    activeSkill: null,
    token: null,
    payload: null,
    cache: { pendingAt: null, currentLevel: null, targetLevel: null, skill: null },
  };
}

const slots = Object.fromEntries(
  Array.from({ length: SLOT_COUNT }, (_, i) => [i + 1, createSlot()]),
);

const clients = new Set();
let nextLogId = 0;
const logCache = [];

function buildLogText(event) {
  const { logType, skill, text, currentLevel, targetLevel } = event;
  if (logType === "success") {
    const name = SKILL_DISPLAY[skill] || skill;
    return `[${name}] Lv.${currentLevel} \u2192 Lv.${targetLevel}`;
  }
  if (logType === "retry") {
    const name = SKILL_DISPLAY[skill] || skill;
    return `[${name}] Upgrade pending, waiting...`;
  }
  if (logType === "info" && skill && text && text.includes("cancelled")) {
    const name = SKILL_DISPLAY[skill] || skill;
    return `[${name}] Upgrade cancelled.`;
  }
  return text || "";
}

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

async function verifySlotState(n) {
  const slot = slots[n];
  if (!slot.running || !slot.token || !slot.activeSkill || !slot.payload) return;

  const log = (level, logType, text, extra = {}) => {
    const entry = { type: "log", slot: n, logType, text, skill: slot.activeSkill, ...extra };
    pushLogCache(entry);
    broadcast(entry);
  };

  try {
    const { body: data } = await postJson(
      API_UPGRADE,
      slot.payload,
      slot.token,
      AbortSignal.timeout(10000),
    );

    if (data?.success) {
      slot.cache.pendingAt = data.pending_at || null;
      slot.cache.currentLevel = data.current_level ?? slot.cache.currentLevel;
      slot.cache.targetLevel = data.target_level ?? slot.cache.targetLevel;
      slot.cache.skill = data.skill || slot.activeSkill;
      log("info", "success", buildLogText({
        logType: "success",
        skill: data.skill || slot.activeSkill,
        currentLevel: data.current_level,
        targetLevel: data.target_level,
      }));
      return;
    }

    if (data?.pending_at && data?.remaining_ms != null) {
      slot.cache.pendingAt = data.pending_at;
      slot.cache.skill = data.active_skill || slot.activeSkill;
      log("info", "retry", buildLogText({
        logType: "retry",
        skill: data.active_skill || slot.activeSkill,
      }));
      return;
    }

    log("warn", "warn", "Upgrade no longer active on game server. Stopping loop.");
    slot.abortController.abort();
  } catch (err) {
    log("warn", "warn", `State verify failed: ${err.message}. Loop continues.`);
  }
}

export function createApp(logger) {
  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);

  app.register(async function (fastify) {
    fastify.get("/ws", { websocket: true }, (socket) => {
      clients.add(socket);

      logger.debug({ event: "ws_connect", clientCount: clients.size }, "WebSocket client connected");

      (async () => {
        for (let i = 1; i <= SLOT_COUNT; i++) {
          if (slots[i].running) await verifySlotState(i);
        }
      })();

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

        logger.debug({ action: msg.action, slot: msg.slot }, "WS message received");

        if (msg.action === "sync") {
          for (let i = 1; i <= SLOT_COUNT; i++) {
            if (slots[i].running) await verifySlotState(i);
          }
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
          return sendError(socket, n, "Invalid slot.");
        }

        if (msg.action === "start") {
          handleStart(socket, n, msg, logger);
        } else if (msg.action === "stop") {
          await handleStop(socket, n, logger);
        } else if (msg.action === "status") {
          socket.send(
            JSON.stringify({ type: "status", slots: snapshotStatus() }),
          );
        }
      });

      socket.on("close", () => {
        clients.delete(socket);
        logger.debug({ clientCount: clients.size }, "WebSocket client disconnected");
      });
    });
  });

  app.register(fastifyStatic, {
    root: join(__dirname, "views"),
    prefix: "/",
  });

  return app;
}

function handleStart(socket, n, msg, logger) {
  const slot = slots[n];
  if (slot.running) {
    return sendError(socket, n, "Loop already running.");
  }

  const { game, authorization, skill = "3", pay = "1" } = msg;
  if (!game || !authorization) {
    return sendError(socket, n, "Fields 'game' and 'authorization' are required.");
  }

  const runner = resolveGameRunner(game.toLowerCase());
  if (!runner) {
    return sendError(socket, n, `Game '${game}' not supported.`);
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
  slot.payload = payload;
  broadcast({ type: "status", slots: snapshotStatus() });

  logger.info({ slot: n, skill: payload.skill, pay: payload.type }, "Upgrade loop started");

  const onLog = (event) => {
    const { type: logType, skill: evSkill, ...rest } = event;
    if (evSkill) slot.activeSkill = evSkill;

    if (rest.pendingAt) slot.cache.pendingAt = rest.pendingAt;
    if (rest.currentLevel != null) slot.cache.currentLevel = rest.currentLevel;
    if (rest.targetLevel != null) slot.cache.targetLevel = rest.targetLevel;
    if (evSkill) slot.cache.skill = evSkill;

    const text = buildLogText({ logType, skill: evSkill, ...rest });
    const entry = { type: "log", slot: n, logType, skill: evSkill, text, ...rest };
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
    slot.payload = null;
    slot.cache = { pendingAt: null, currentLevel: null, targetLevel: null, skill: null };
    broadcast({ type: "stopped", slot: n, text: "Loop stopped." });
    broadcast({ type: "status", slots: snapshotStatus() });
    logger.info({ slot: n }, "Upgrade loop stopped");
  });
}

async function handleStop(socket, n, logger) {
  const slot = slots[n];
  if (!slot.running) {
    return sendError(socket, n, "Loop is not running.");
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
        const text = buildLogText({
          logType: "info",
          skill: res.skill,
          text: `Upgrade ${res.skill} cancelled.`,
        });
        const entry = {
          type: "log",
          slot: n,
          logType: "info",
          skill: res.skill,
          text,
        };
        pushLogCache(entry);
        broadcast(entry);
        logger.info({ slot: n, skill: res.skill }, "Upgrade cancelled on game server");
      } else {
        const entry = {
          type: "log",
          slot: n,
          logType: "warn",
          text: "Failed to cancel upgrade on game server.",
        };
        pushLogCache(entry);
        broadcast(entry);
        logger.warn({ slot: n }, "Failed to cancel upgrade on game server");
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
      logger.warn({ slot: n, err: err.message }, "Cancel request failed");
    }
  }

  slot.abortController.abort();
}

function sendError(socket, slot, text) {
  socket.send(JSON.stringify({ type: "error", slot, text }));
}