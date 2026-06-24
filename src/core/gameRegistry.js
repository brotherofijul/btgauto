import { runUpgradeLoop } from "../games/diplomacia/service.js";

const registry = new Map([
  [
    "diplomacia",
    async ({ token, payload, signal, onLog }) => {
      await runUpgradeLoop({ token, payload, signal, onLog });
    },
  ],
]);

export const resolveGameRunner = (key) => registry.get(key) ?? null;
