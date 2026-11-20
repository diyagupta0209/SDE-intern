const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function durationMs(expression) {
  const match = /^(\d+)([smhd])$/.exec(expression);
  if (!match) {
    throw new Error(`Invalid duration: ${expression}`);
  }
  return Number(match[1]) * UNITS[match[2]];
}
