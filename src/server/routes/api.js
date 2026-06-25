import { resolveGameRunner } from "../../core/gameRegistry.js";
import { resolveUpgradePayload } from "../../games/diplomacia/validator.js";
import { postJson } from "../../core/httpClient.js";
import { API_CANCEL } from "../../games/diplomacia/config.js";

const SLOT_COUNT = 2;

function createSlotState() {
  return {
    abortController: null,
    running: false,
    activeSkill: null,
    token: null,
    /* cache untuk sync ke client yang baru reconnect */
    cache: { pendingAt: null, currentLevel: null, targetLevel: null, skill: null },
  };
}

const slots = {};
for (let i = 1; i <= SLOT_COUNT; i++) slots[i] = createSlotState();

const clients = new Set();

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
    const c = slots[i].cache;
    out[i] = {
      pendingAt: c.pendingAt,
      currentLevel: c.currentLevel,
      targetLevel: c.targetLevel,
      skill: c.skill,
    };
  }
  return out;
}

function sendError(socket, slot, text) {
  socket.send(JSON.stringify({ type: "error", slot, text }));
}

export async function apiRoutes(app) {
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "status", slots: snapshotStatus() }));

    socket.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      /* sync tidak butuh slot — langsung proses */
      if (msg.action === "sync") {
        socket.send(
          JSON.stringify({ type: "sync", slots: snapshotCache(), status: snapshotStatus() }),
        );
        return;
      }

      const n = Number(msg.slot);
      if (n < 1 || n > SLOT_COUNT) {
        return sendError(socket, n, "Slot tidak valid.");
      }
      if (msg.action === "start") {
        const slot = slots[n];
        if (slot.running) {
          return sendError(socket, n, "Loop sudah berjalan.");
        }

        const { game, authorization, skill = "3", pay = "1" } = msg;
        if (!game || !authorization) {
          return sendError(
            socket,
            n,
            "Field 'game' dan 'authorization' wajib diisi.",
          );
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

          /* simpan cache terbaru (pendingAt, level, skill) */
          if (rest.pendingAt) slot.cache.pendingAt = rest.pendingAt;
          if (rest.currentLevel != null) slot.cache.currentLevel = rest.currentLevel;
          if (rest.targetLevel != null) slot.cache.targetLevel = rest.targetLevel;
          if (evSkill) slot.cache.skill = evSkill;

          broadcast({ type: "log", slot: n, logType, skill: evSkill, ...rest });
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
      } else if (msg.action === "stop") {
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
              broadcast({
                type: "log",
                slot: n,
                logType: "info",
                skill: res.skill,
                text: `Upgrade ${res.skill} dibatalkan.`,
              });
            } else {
              broadcast({
                type: "log",
                slot: n,
                logType: "warn",
                text: "Gagal membatalkan upgrade di server.",
              });
            }
          } catch (err) {
            broadcast({
              type: "log",
              slot: n,
              logType: "warn",
              text: `Cancel error: ${err.message}`,
            });
          }
        }
        slot.abortController.abort();
      } else if (msg.action === "status") {
        socket.send(
          JSON.stringify({ type: "status", slots: snapshotStatus() }),
        );
      }
    });

    socket.on("close", () => clients.delete(socket));
  });
}
