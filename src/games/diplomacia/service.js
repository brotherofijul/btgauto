import { postJson } from "../../core/httpClient.js";
import { sleepAbortable, randomJitter } from "../../utils/time.js";
import {
  API_URL,
  ERROR_RETRY_DELAY_MS,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
} from "./config.js";

export async function runUpgradeLoop({ token, payload, signal, onLog }) {
  onLog({ type: "info", text: "Loop dimulai." });

  while (!signal.aborted) {
    try {
      const { body: data } = await postJson(API_URL, payload, token, signal);
      if (signal.aborted) break;

      if (data?.success) {
        onLog({
          type: "success",
          skill: data.skill,
          currentLevel: data.current_level,
          targetLevel: data.target_level,
          cooldownMs: data.cooldown_ms,
          pendingAt: data.pending_at,
        });
        await sleepAbortable(
          data.cooldown_ms + randomJitter(JITTER_MIN_MS, JITTER_MAX_MS),
          signal,
        );
      } else {
        onLog({
          type: "warn",
          text: "Respons server tidak sukses — retry dalam 30 detik.",
        });
        await sleepAbortable(ERROR_RETRY_DELAY_MS, signal);
      }
    } catch (err) {
      if (signal.aborted) break;
      onLog({
        type: "error",
        text: `${err.name}: ${err.message} — retry dalam 30 detik.`,
      });
      await sleepAbortable(ERROR_RETRY_DELAY_MS, signal);
    }
  }

  onLog({ type: "info", text: "Loop selesai." });
}
