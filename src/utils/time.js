export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function formatCooldown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} menit ${seconds} detik` : `${seconds} detik`;
}

export function randomJitter(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
