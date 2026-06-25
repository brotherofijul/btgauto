// src/games/diplomacia/service.js
import { postJson } from "../../lib/http-client.js";
import { sleepAbortable, randomJitter } from "../../lib/time.js";
import {
  API_UPGRADE,
  ERROR_RETRY_DELAY_MS,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
} from "./config.js";

export async function runUpgradeLoop({ token, payload, signal, onLog }) {
  onLog({ type: "info", text: "Loop dimulai." });

  while (!signal.aborted) {
    try {
      const { body: data } = await postJson(
        API_UPGRADE,
        payload,
        token,
        signal,
      );
      if (signal.aborted) break;

      if (data?.success) {
        onLog({
          type: "success",
          skill: data.skill,
          currentLevel: data.current_level,
          targetLevel: data.target_level,
          pendingAt: data.pending_at,
        });
        await sleepAbortable(
          data.cooldown_ms + randomJitter(JITTER_MIN_MS, JITTER_MAX_MS),
          signal,
        );
        continue;
      }

      if (data?.pending_at && data?.remaining_ms != null) {
        onLog({
          type: "retry",
          skill: data.active_skill,
          pendingAt: data.pending_at,
        });
        await sleepAbortable(
          data.remaining_ms + randomJitter(JITTER_MIN_MS, JITTER_MAX_MS),
          signal,
        );
        continue;
      }

      onLog({ type: "warn", text: "Respons tidak sukses — retry 30 detik." });
      await sleepAbortable(ERROR_RETRY_DELAY_MS, signal);
    } catch (err) {
      if (signal.aborted) break;
      onLog({
        type: "error",
        text: `${err.name}: ${err.message} — retry 30 detik.`,
      });
      await sleepAbortable(ERROR_RETRY_DELAY_MS, signal);
    }
  }

  onLog({ type: "info", text: "Loop selesai." });
}