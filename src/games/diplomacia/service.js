import { postJson } from "../../core/httpClient.js";
import { sleep, formatCooldown, randomJitter } from "../../utils/time.js";
import {
  API_URL,
  ERROR_RETRY_DELAY_MS,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
} from "./config.js";

export async function runUpgradeLoop({ token, payload, debug = false }) {
  while (true) {
    try {
      const response = await postJson(API_URL, payload, token);
      const data = response.body;

      if (data?.success) {
        const waitLabel = formatCooldown(data.cooldown_ms);
        console.log(
          `[${data.skill}]: ${data.current_level} -> ${data.target_level} (${waitLabel})`,
        );

        const jitter = randomJitter(JITTER_MIN_MS, JITTER_MAX_MS);
        await sleep(data.cooldown_ms + jitter);
      } else {
        console.error("Gagal melakukan upgrade: Respons server tidak sukses.");
        await sleep(ERROR_RETRY_DELAY_MS);
      }
    } catch (error) {
      logRequestError(error, debug);
      await sleep(ERROR_RETRY_DELAY_MS);
    }
  }
}

function logRequestError(error, debug) {
  console.error("Terjadi kesalahan koneksi atau API.");
  if (!debug) return;

  if (error.response?.body) {
    console.error("Detail Error:", error.response.body);
  } else {
    console.error(error.message);
  }
}
