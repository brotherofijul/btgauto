import { resolveGameRunner } from "../../core/gameRegistry.js";

const MAX_SLOTS = 2;

const slots = {};
for (let i = 1; i <= MAX_SLOTS; i++) {
  slots[i] = { abortController: null, running: false };
}

const wsClients = new Set();

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function getSlotsStatus() {
  const result = {};
  for (let i = 1; i <= MAX_SLOTS; i++) {
    result[i] = { running: slots[i].running };
  }
  return result;
}

export async function apiRoutes(app) {
  app.get("/ws", { websocket: true }, (socket) => {
    wsClients.add(socket);
    socket.send(JSON.stringify({ type: "status", slots: getSlotsStatus() }));

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const n = Number(msg.slot);
      if (n < 1 || n > MAX_SLOTS) {
        return socket.send(
          JSON.stringify({ type: "error", slot: n, text: "Slot tidak valid." }),
        );
      }

      if (msg.action === "start") {
        const slot = slots[n];
        if (slot.running) {
          return socket.send(
            JSON.stringify({
              type: "error",
              slot: n,
              text: "Loop sudah berjalan di slot ini.",
            }),
          );
        }

        const { game, authorization, skill = "3", pay = "1" } = msg;
        if (!game || !authorization) {
          return socket.send(
            JSON.stringify({
              type: "error",
              slot: n,
              text: "Field 'game' dan 'authorization' wajib diisi.",
            }),
          );
        }

        const runner = resolveGameRunner(game.toLowerCase());
        if (!runner) {
          return socket.send(
            JSON.stringify({
              type: "error",
              slot: n,
              text: `Game '${game}' tidak didukung.`,
            }),
          );
        }

        slot.abortController = new AbortController();
        slot.running = true;
        broadcast({ type: "status", slots: getSlotsStatus() });

        /* Pisahkan type event dari type pesan WebSocket */
        const onLog = (event) => {
          const { type: logType, ...rest } = event;
          broadcast({ type: "log", slot: n, logType, ...rest });
        };

        runner({
          token: authorization,
          skill,
          pay,
          signal: slot.abortController.signal,
          onLog,
        }).finally(() => {
          slot.abortController = null;
          slot.running = false;
          broadcast({ type: "stopped", slot: n, text: "Loop dihentikan." });
          broadcast({ type: "status", slots: getSlotsStatus() });
        });
      } else if (msg.action === "stop") {
        const slot = slots[n];
        if (!slot.running) {
          return socket.send(
            JSON.stringify({
              type: "error",
              slot: n,
              text: "Loop tidak sedang berjalan di slot ini.",
            }),
          );
        }
        slot.abortController.abort();
      } else if (msg.action === "status") {
        socket.send(
          JSON.stringify({ type: "status", slots: getSlotsStatus() }),
        );
      }
    });

    socket.on("close", () => wsClients.delete(socket));
  });
}
