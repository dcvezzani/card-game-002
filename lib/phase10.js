import deckConfig from "../config/deck.json" with { type: "json" };
import { colorByName } from "./spriteMap.js";

const numberColors = deckConfig.numberColors.map((name) => colorByName(name));
const wildColor = colorByName(deckConfig.wildColor);
const skipColor = colorByName(deckConfig.skipColor);

if (!numberColors.length) throw new Error("config/deck.json needs at least one number color");

/** Colors dealt as numbered cards. Edit config/deck.json to change them. */
export function deckNumberColors() {
  return numberColors;
}

export const WILD_COUNT = 8;
export const SKIP_COUNT = 4;
export const DEAL_COUNT = 10;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const RANK_MAX = 13;

export const PHASES = [
  {
    phase: 1,
    label: "2 sets of 3",
    groups: [
      { kind: "set", count: 3 },
      { kind: "set", count: 3 },
    ],
  },
  {
    phase: 2,
    label: "1 set of 3 + 1 run of 4",
    groups: [
      { kind: "set", count: 3 },
      { kind: "run", count: 4 },
    ],
  },
  {
    phase: 3,
    label: "1 set of 4 + 1 run of 4",
    groups: [
      { kind: "set", count: 4 },
      { kind: "run", count: 4 },
    ],
  },
  { phase: 4, label: "1 run of 7", groups: [{ kind: "run", count: 7 }] },
  { phase: 5, label: "1 run of 8", groups: [{ kind: "run", count: 8 }] },
  { phase: 6, label: "1 run of 9", groups: [{ kind: "run", count: 9 }] },
  {
    phase: 7,
    label: "2 sets of 4",
    groups: [
      { kind: "set", count: 4 },
      { kind: "set", count: 4 },
    ],
  },
  { phase: 8, label: "7 cards of one color", groups: [{ kind: "color", count: 7 }] },
  {
    phase: 9,
    label: "1 set of 5 + 1 set of 2",
    groups: [
      { kind: "set", count: 5 },
      { kind: "set", count: 2 },
    ],
  },
  {
    phase: 10,
    label: "1 set of 5 + 1 set of 3",
    groups: [
      { kind: "set", count: 5 },
      { kind: "set", count: 3 },
    ],
  },
];

export function phaseDef(phase) {
  const found = PHASES.find((entry) => entry.phase === phase);
  if (!found) throw new RangeError("phase must be 1–10");
  return found;
}

export function cardScore(card) {
  if (card.type === "wild") return 25;
  if (card.type === "skip") return 15;
  if (card.rank >= 10) return 10;
  return 5;
}

export function scoreHand(cards) {
  return cards.reduce((total, card) => total + cardScore(card), 0);
}

export function createDeck() {
  const cards = [];
  let number = 0;
  for (const color of numberColors) {
    for (let rank = 1; rank <= RANK_MAX; rank += 1) {
      cards.push({ id: `n${number}`, type: "number", color: color.id, rank });
      number += 1;
    }
  }
  for (let i = 0; i < WILD_COUNT; i += 1) {
    cards.push({ id: `w${i}`, type: "wild", color: wildColor.id });
  }
  for (let i = 0; i < SKIP_COUNT; i += 1) {
    cards.push({ id: `s${i}`, type: "skip", color: skipColor.id });
  }
  return cards;
}

export function shuffle(cards, random = Math.random) {
  const next = cards.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Mulberry32. `seed` is any integer. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rankOf(card) {
  if (card.type === "number") return card.rank;
  if (card.type === "wild") return card.asRank ?? null;
  return null;
}

function validateSet(cards) {
  const ranks = cards.map(rankOf);
  if (ranks.some((rank) => rank == null || rank < 1 || rank > RANK_MAX)) {
    return "Each Wild in a set needs a rank";
  }
  if (new Set(ranks).size !== 1) return "A set must share one rank";
  return null;
}

function validateRun(cards) {
  const ranks = cards.map(rankOf);
  if (ranks.some((rank) => rank == null || rank < 1 || rank > RANK_MAX)) {
    return "Each Wild in a run needs a rank";
  }
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return "A run must be consecutive";
  }
  return null;
}

function validateColor(cards) {
  const colors = [];
  for (const card of cards) {
    if (card.type === "number") colors.push(card.color);
    else if (card.type === "wild") {
      if (card.asColor == null || !numberColors.some((color) => color.id === card.asColor)) {
        return "Each Wild needs a color";
      }
      colors.push(card.asColor);
    }
  }
  if (new Set(colors).size !== 1) return "Those cards must share one color";
  return null;
}

export function validateGroup(kind, cards, min) {
  if (!Array.isArray(cards) || cards.length < min) return `Need at least ${min} cards`;
  if (cards.some((card) => card.type === "skip")) return "A Skip cannot be played in a phase";
  if (kind === "set") return validateSet(cards);
  if (kind === "run") return validateRun(cards);
  if (kind === "color") return validateColor(cards);
  return "Unknown meld";
}

export function validateLayDown(phase, groups) {
  const def = phaseDef(phase);
  if (!Array.isArray(groups) || groups.length !== def.groups.length) {
    return `${def.label} needs ${def.groups.length} groups`;
  }
  const seen = new Set();
  for (let i = 0; i < def.groups.length; i += 1) {
    const need = def.groups[i];
    const cards = groups[i];
    if (!Array.isArray(cards)) return "Each group needs cards";
    for (const card of cards) {
      if (seen.has(card.id)) return "A card can only be in one group";
      seen.add(card.id);
    }
    const error = validateGroup(need.kind, cards, need.count);
    if (error) return error;
  }
  return null;
}

/** Move a starter Skip back into the deck and repeat until the top card is not a Skip. */
export function buryStarterSkip(cards) {
  const deck = cards.slice();
  let buried = 0;
  while (deck.length && deck[deck.length - 1].type === "skip" && buried < SKIP_COUNT) {
    const skip = deck.pop();
    const at = Math.floor(deck.length / 2);
    deck.splice(at, 0, skip);
    buried += 1;
    if (deck[deck.length - 1] === skip) break;
  }
  return deck;
}

export function preparePiles(deck, playerCount) {
  const cards = deck.slice();
  const hands = Array.from({ length: playerCount }, () => []);
  for (let n = 0; n < DEAL_COUNT; n += 1) {
    for (let i = 0; i < playerCount; i += 1) hands[i].push(cards.pop());
  }
  const rest = buryStarterSkip(cards);
  if (!rest.length) throw new Error("deck ran out before the discard");
  return { hands, discard: [rest.pop()], draw: rest };
}
