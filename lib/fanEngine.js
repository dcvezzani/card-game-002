import { cropForCard } from "./spriteMap.js";

export const FAN_DEFAULTS = {
  spreadDeg: 80,
  radius: 260,
  cardWidth: 136,
  cardHeight: 242,
};

/**
 * Lay cards in a circular fan. Angles run left-negative to right-positive.
 * x/y are CSS pixels relative to a pivot under the hand (y up is negative).
 * @param {object[]} cards
 * @param {Partial<typeof FAN_DEFAULTS>} [options]
 */
export function layoutFan(cards, options = {}) {
  const { spreadDeg, radius, cardWidth, cardHeight } = {
    ...FAN_DEFAULTS,
    ...options,
  };

  const n = cards.length;
  const start = n <= 1 ? 0 : -spreadDeg / 2;
  const step = n <= 1 ? 0 : spreadDeg / (n - 1);

  return cards.map((card, i) => {
    const angleDeg = start + i * step;
    const angleRad = (angleDeg * Math.PI) / 180;

    return {
      ...card,
      angleDeg,
      x: Math.sin(angleRad) * radius,
      y: -Math.cos(angleRad) * radius,
      zIndex: i + 1,
      cardWidth,
      cardHeight,
      sprite: cropForCard(card),
    };
  });
}

export function handOfThirteen() {
  const cards = Array.from({ length: 13 }, (_, i) => ({
    id: `sample-${i + 1}`,
    type: "number",
    color: 0,
    rank: i + 1,
  }));
  return {
    sheetUrl: "/assets/cards.png",
    selectedRank: 1,
    cardWidth: FAN_DEFAULTS.cardWidth,
    cardHeight: FAN_DEFAULTS.cardHeight,
    radius: FAN_DEFAULTS.radius,
    cards: layoutFan(cards),
  };
}
