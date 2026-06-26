// src/games/diplomacia/validator.js
import { SKILL_MAP, PAY_MAP } from "./config.js";

export function resolveUpgradePayload(options) {
  const skill = SKILL_MAP[Number(options.skill)];
  const type = PAY_MAP[Number(options.pay)];
  if (!skill || !type)
    throw new Error("Invalid skill or payment method.");
  return { skill, type };
}