import { cropForRank } from "./spriteMap.js";

export const FAN_DEFAULTS = {
  spreadDeg: 80,
  radius: 260,
  cardWidth: 136,
  cardHeight: 242,
  row: 0,
};

/**
 * Lay out ranks in a circular fan. Angles run left-negative to right-positive.
 * x/y are CSS pixels relative to a pivot under the hand (y up is negative).
 * @param {number[]} ranks
 * @param {Partial<typeof FAN_DEFAULTS>} [options]
 */
export function layoutFan(ranks, options = {}) {
  const { spreadDeg, radius, cardWidth, cardHeight, row } = {
    ...FAN_DEFAULTS,
    ...options,
  };

  const n = ranks.length;
  const start = n <= 1 ? 0 : -spreadDeg / 2;
  const step = n <= 1 ? 0 : spreadDeg / (n - 1);

  return ranks.map((rank, i) => {
    const angleDeg = start + i * step;
    const angleRad = (angleDeg * Math.PI) / 180;

    return {
      rank,
      angleDeg,
      x: Math.sin(angleRad) * radius,
      y: -Math.cos(angleRad) * radius,
      zIndex: i + 1,
      cardWidth,
      cardHeight,
      sprite: cropForRank(rank, row),
    };
  });
}

export function handOfThirteen() {
  const ranks = Array.from({ length: 13 }, (_, i) => i + 1);
  return {
    sheetUrl: "/assets/cards.png",
    selectedRank: 1,
    cardWidth: FAN_DEFAULTS.cardWidth,
    cardHeight: FAN_DEFAULTS.cardHeight,
    radius: FAN_DEFAULTS.radius,
    cards: layoutFan(ranks),
  };
}
