import { runUpgradeLoop } from "../games/diplomacia/service.js";

const registry = new Map([
  ["diplomacia", runUpgradeLoop],
]);

export const resolveGameRunner = (key) => registry.get(key) ?? null;