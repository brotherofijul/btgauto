import { resolveUpgradePayload } from "../games/diplomacia/validator.js";
import { runUpgradeLoop } from "../games/diplomacia/service.js";

export async function handler(options) {
  try {
    const payload = resolveUpgradePayload(options);
    await runUpgradeLoop({
      token: options.authorization,
      payload,
      debug: Boolean(options.debug),
    });
  } catch (error) {
    console.error(`[Error] ${error.message}`);
    process.exit(1);
  }
}
