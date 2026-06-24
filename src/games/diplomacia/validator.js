import { SKILL_MAP, PAY_MAP } from "./config.js";

export function resolveUpgradePayload(options) {
  const skill = SKILL_MAP[Number(options.skill)];
  const type = PAY_MAP[Number(options.pay)];
  if (!skill || !type)
    throw new Error("Argumen skill atau metode pembayaran tidak valid.");
  return { skill, type };
}
