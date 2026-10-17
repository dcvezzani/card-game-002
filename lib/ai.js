import { assignGroup } from "../public/js/melds.js";
import { cardScore, phaseDef, validateGroup, validateLayDown } from "./phase10.js";

const SHORT_HAND = 4;

function rankOf(card) {
  if (card.type === "number") return card.rank;
  if (card.type === "wild") return card.asRank ?? null;
  return null;
}

function meldColor(meld) {
  return (
    meld.cards.find((card) => card.type === "number")?.color ??
    meld.cards.find((card) => card.asColor != null)?.asColor ??
    null
  );
}

function materialize(hand, spec) {
  const card = hand.find((entry) => entry.id === spec.id);
  const next = { id: card.id, type: card.type };
  if (card.color != null) next.color = card.color;
  if (card.type === "number") next.rank = card.rank;
  if (card.type === "wild") {
    if (spec.asRank != null) next.asRank = spec.asRank;
    if (spec.asColor != null) next.asColor = spec.asColor;
  }
  return next;
}

function groupBy(cards, key) {
  const groups = new Map();
  for (const card of cards) {
    const value = key(card);
    const list = groups.get(value);
    if (list) list.push(card);
    else groups.set(value, [card]);
  }
  return groups;
}

function choicesFor(group, numbers, wilds) {
  const choices = [{ used: new Set(), covered: 0, wildsUsed: 0 }];
  if (group.kind === "set" || group.kind === "color") {
    const buckets = groupBy(numbers, (card) => (group.kind === "set" ? card.rank : card.color));
    for (const bucket of buckets.values()) {
      const used = new Set(bucket.map((card) => card.id));
      const maxWild = Math.min(wilds, Math.max(0, group.count - bucket.length));
      for (let usedWilds = 0; usedWilds <= maxWild; usedWilds += 1) {
        choices.push({
          used,
          covered: Math.min(group.count, bucket.length + usedWilds),
          wildsUsed: usedWilds,
        });
      }
    }
    return choices;
  }

  if (group.kind !== "run") return choices;
  const maxBare = Math.min(wilds, group.count);
  for (let usedWilds = 1; usedWilds <= maxBare; usedWilds += 1) {
    choices.push({ used: new Set(), covered: usedWilds, wildsUsed: usedWilds });
  }
  for (let start = 1; start <= 14 - group.count; start += 1) {
    const used = new Set();
    for (let rank = start; rank < start + group.count; rank += 1) {
      const card = numbers.find((entry) => entry.rank === rank && !used.has(entry.id));
      if (card) used.add(card.id);
    }
    const naturals = used.size;
    if (!naturals) continue;
    const maxWild = Math.min(wilds, group.count - naturals);
    for (let usedWilds = 0; usedWilds <= maxWild; usedWilds += 1) {
      choices.push({
        used,
        covered: naturals + usedWilds,
        wildsUsed: usedWilds,
      });
    }
  }
  return choices;
}

function cardsShort(phase, hand) {
  const numbers = hand.filter((card) => card.type === "number");
  const wilds = hand.filter((card) => card.type === "wild").length;

  function assign(groups, pool, wildsLeft) {
    if (!groups.length) return 0;
    const [group, ...rest] = groups;
    let best = group.count + assign(rest, pool, wildsLeft);
    for (const choice of choicesFor(group, pool, wildsLeft)) {
      const left = pool.filter((card) => !choice.used.has(card.id));
      const total = group.count - choice.covered + assign(rest, left, wildsLeft - choice.wildsUsed);
      if (total < best) best = total;
    }
    return best;
  }

  return assign(phaseDef(phase).groups, numbers, wilds);
}

function forEachCombo(items, size, visit) {
  const picked = [];
  function walk(start) {
    if (picked.length === size) {
      visit(picked);
      return;
    }
    for (let index = start; index <= items.length - (size - picked.length); index += 1) {
      picked.push(items[index]);
      walk(index + 1);
      picked.pop();
    }
  }
  walk(0);
}

function bestLay(hand, phase) {
  const defs = phaseDef(phase).groups;
  const pool = hand.filter((card) => card.type !== "skip");
  let best = null;

  function consider(specs) {
    const used = specs.reduce((total, group) => total + group.length, 0);
    if (used >= hand.length || used < 1) return;
    const built = specs.map((group) => group.map((spec) => materialize(hand, spec)));
    if (validateLayDown(phase, built)) return;
    const usedIds = new Set(specs.flat().map((spec) => spec.id));
    const leftover = hand
      .filter((card) => !usedIds.has(card.id))
      .reduce((total, card) => total + cardScore(card), 0);
    if (!best || used > best.used || (used === best.used && leftover < best.leftover)) {
      best = { specs: specs.map((group) => group.slice()), used, leftover };
    }
  }

  function search(index, chosen) {
    if (index === defs.length) {
      consider(chosen);
      return;
    }
    const usedIds = new Set(chosen.flat().map((spec) => spec.id));
    const available = pool.filter((card) => !usedIds.has(card.id));
    const already = chosen.reduce((total, group) => total + group.length, 0);
    const restMin = defs.slice(index + 1).reduce((total, group) => total + group.count, 0);
    const maxSize = Math.min(available.length - restMin, hand.length - 1 - already - restMin);
    if (maxSize < defs[index].count) return;
    for (let size = defs[index].count; size <= maxSize; size += 1) {
      forEachCombo(available, size, (combo) => {
        const spec = assignGroup(defs[index].kind, combo.slice());
        if (!spec) return;
        chosen.push(spec);
        search(index + 1, chosen);
        chosen.pop();
      });
    }
  }

  search(0, []);
  return best?.specs ?? null;
}

function hitSpecs(meld, cards) {
  const ranks = meld.cards.map(rankOf).filter((rank) => rank != null);
  let color = meldColor(meld);
  const specs = [];
  for (const card of cards) {
    if (card.type === "number") {
      specs.push({ id: card.id });
      if (meld.kind !== "color") ranks.push(card.rank);
      continue;
    }
    if (card.type !== "wild") return null;
    if (meld.kind === "set") {
      const rank = ranks.find((value) => value != null);
      if (rank == null) return null;
      specs.push({ id: card.id, asRank: rank });
    } else if (meld.kind === "color") {
      if (color == null) return null;
      specs.push({ id: card.id, asColor: color });
    } else {
      const sorted = ranks.slice().sort((a, b) => a - b);
      if (!sorted.length) return null;
      const high = sorted.at(-1) + 1;
      const low = sorted[0] - 1;
      const asRank = high <= 13 ? high : low;
      if (asRank < 1 || asRank > 13) return null;
      specs.push({ id: card.id, asRank });
      ranks.push(asRank);
    }
  }
  return specs;
}

function cardsThatHit(meld, hand) {
  const accepted = [];
  let current = meld.cards.map((card) => ({ ...card }));
  for (const card of hand) {
    if (accepted.length >= hand.length - 1) break;
    const specs = hitSpecs({ ...meld, cards: current }, [card]);
    if (!specs) continue;
    const next = current.concat(specs.map((spec) => materialize([card], spec)));
    if (validateGroup(meld.kind, next, meld.min)) continue;
    accepted.push(specs[0]);
    current = next;
  }
  return accepted;
}

function bestHit(view, me) {
  if (me.hand.length < 2) return null;
  let best = null;
  for (const player of view.players) {
    if (player.left) continue;
    player.melds.forEach((meld, meldIndex) => {
      const cards = cardsThatHit(meld, me.hand);
      if (!cards.length) return;
      if (!best || cards.length > best.cards.length) {
        best = { ownerId: player.id, meldIndex, cards };
      }
    });
  }
  if (!best) return null;
  return { type: "hit", ownerId: best.ownerId, meldIndex: best.meldIndex, cards: best.cards };
}

function placeWild(meld) {
  if (meld.kind === "set") {
    const rank = meld.cards.map(rankOf).find((value) => value != null);
    if (rank == null) return null;
    return { asRank: rank };
  }
  if (meld.kind === "color") {
    const color = meldColor(meld);
    if (color == null) return null;
    return { asColor: color };
  }
  const ranks = meld.cards.map(rankOf).filter((value) => value != null).sort((a, b) => a - b);
  if (!ranks.length) return null;
  const high = ranks.at(-1) + 1;
  const low = ranks[0] - 1;
  const asRank = high <= 13 ? high : low;
  if (asRank < 1 || asRank > 13) return null;
  return { asRank };
}

function bestSwap(view, me) {
  if (me.hand.length < 2) return null;
  const melds = [];
  for (const player of view.players) {
    if (player.left) continue;
    player.melds.forEach((meld, meldIndex) => {
      melds.push({ ownerId: player.id, meldIndex, meld });
    });
  }
  if (melds.length < 2) return null;

  for (const source of melds) {
    for (const wild of source.meld.cards) {
      if (wild.type !== "wild" || wild.asRank == null) continue;
      const natural = me.hand.find((card) => {
        if (card.type !== "number" || card.rank !== wild.asRank) return false;
        if (source.meld.kind === "color" && card.color !== wild.asColor) return false;
        return true;
      });
      if (!natural) continue;
      for (const dest of melds) {
        if (dest.ownerId === source.ownerId && dest.meldIndex === source.meldIndex) continue;
        const placement = placeWild(dest.meld);
        if (!placement) continue;
        const sourceCards = source.meld.cards
          .filter((card) => card.id !== wild.id)
          .concat([{ id: natural.id, type: "number", color: natural.color, rank: natural.rank }]);
        const moved = { id: wild.id, type: "wild", ...placement };
        const destCards = dest.meld.cards.concat([moved]);
        if (validateGroup(source.meld.kind, sourceCards, source.meld.min)) continue;
        if (validateGroup(dest.meld.kind, destCards, dest.meld.min)) continue;
        return {
          type: "replaceWild",
          ownerId: source.ownerId,
          meldIndex: source.meldIndex,
          wildCardId: wild.id,
          naturalCardId: natural.id,
          destinationOwnerId: dest.ownerId,
          destinationIndex: dest.meldIndex,
          ...placement,
        };
      }
    }
  }
  return null;
}

function cardHits(view, card) {
  for (const player of view.players) {
    if (player.left) continue;
    for (const meld of player.melds) {
      const specs = hitSpecs(meld, [card]);
      if (!specs) continue;
      const built = meld.cards.concat(specs.map((spec) => materialize([card], spec)));
      if (!validateGroup(meld.kind, built, meld.min)) return true;
    }
  }
  return false;
}

function wantDiscard(view, me) {
  const top = view.discardTop;
  if (!top || top.type === "skip") return false;
  if (me.laidDown) return cardHits(view, top);
  return cardsShort(me.phase, me.hand.concat([top])) < cardsShort(me.phase, me.hand);
}

function nextPlayer(view, playerId) {
  const players = view.players.filter((player) => !player.left && !player.waiting);
  const index = players.findIndex((player) => player.id === playerId);
  if (index < 0 || players.length < 2) return null;
  return players[(index + 1) % players.length];
}

function keepValue(card, me, danger) {
  if (card.type === "skip") return danger ? -1000 : -cardScore(card);
  if (me.laidDown) return -cardScore(card);
  const without = me.hand.filter((entry) => entry.id !== card.id);
  const help = cardsShort(me.phase, without) - cardsShort(me.phase, me.hand);
  if (help > 0) return 1000 * help - cardScore(card);
  return -cardScore(card);
}

function worstCard(view, me) {
  const next = nextPlayer(view, me.id);
  const danger = Boolean(next?.laidDown && next.handCount <= SHORT_HAND);
  return me.hand.reduce((worst, card) =>
    keepValue(card, me, danger) < keepValue(worst, me, danger) ? card : worst,
  );
}

export function chooseAction(view) {
  const me = view.players.find((player) => player.id === view.you?.id);
  if (view.step === "draw") {
    return { type: "draw", source: wantDiscard(view, me) ? "discard" : "draw" };
  }
  if (!me.laidDown) {
    const groups = bestLay(me.hand, me.phase);
    if (groups) return { type: "layDown", groups };
  } else {
    const hit = bestHit(view, me);
    if (hit) return hit;
    const swap = bestSwap(view, me);
    if (swap) return swap;
  }
  return { type: "discard", cardId: worstCard(view, me).id };
}
