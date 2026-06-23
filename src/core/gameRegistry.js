import { runUpgradeLoop } from "../games/diplomacia/service.js";
import { resolveUpgradePayload } from "../games/diplomacia/validator.js";

const registry = new Map([
  [
    "diplomacia",
    async ({ token, skill, pay, signal, onLog }) => {
      const payload = resolveUpgradePayload({ skill, pay });
      await runUpgradeLoop({ token, payload, signal, onLog });
    },
  ],
]);

export const resolveGameRunner = (key) => registry.get(key) ?? null;
export const listAvailableGames = () => [...registry.keys()];
