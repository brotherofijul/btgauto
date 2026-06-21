import { handler as diplomaciaHandler } from "../commands/diplomacia.js";

const registry = new Map([["diplomacia", diplomaciaHandler]]);

export function resolveGameHandler(gameKey) {
  return registry.get(gameKey) ?? null;
}

export function listAvailableGames() {
  return Array.from(registry.keys());
}
