function rankOf(card) {
  if (card.type === "number") return card.rank;
  if (card.type === "wild") return card.asRank ?? null;
  return null;
}

export function groupLabel(group) {
  if (group.kind === "set") return `Set of ${group.count}`;
  if (group.kind === "run") return `Run of ${group.count}`;
  return `${group.count} of one color`;
}

export function assignGroup(kind, cards) {
  if (cards.some((card) => card.type === "skip")) return null;

  if (kind === "set") {
    const rank = cards.find((card) => card.type === "number")?.rank;
    if (cards.some((card) => card.type === "wild") && rank == null) return null;
    if (cards.some((card) => card.type === "number" && card.rank !== rank)) return null;
    return cards.map((card) => (card.type === "wild" ? { id: card.id, asRank: rank } : { id: card.id }));
  }

  if (kind === "color") {
    const color = cards.find((card) => card.type === "number")?.color;
    if (cards.some((card) => card.type === "wild") && color == null) return null;
    if (cards.some((card) => card.type === "number" && card.color !== color)) return null;
    return cards.map((card) =>
      card.type === "wild" ? { id: card.id, asColor: color } : { id: card.id },
    );
  }

  if (kind !== "run") return null;
  const wilds = cards.filter((card) => card.type === "wild");
  const naturals = cards.filter((card) => card.type === "number");
  if (wilds.length + naturals.length !== cards.length) return null;
  const need = cards.length;

  for (let start = 1; start <= 14 - need; start += 1) {
    const sequence = Array.from({ length: need }, (_, index) => start + index);
    const pool = new Map();
    for (const card of naturals) pool.set(card.rank, [...(pool.get(card.rank) ?? []), card]);
    let wildNeed = 0;
    for (const rank of sequence) {
      const list = pool.get(rank);
      if (list?.length) list.pop();
      else wildNeed += 1;
    }
    if ([...pool.values()].some((list) => list.length) || wildNeed !== wilds.length) continue;

    const used = new Set();
    return sequence.map((rank) => {
      const natural = naturals.find((card) => card.rank === rank && !used.has(card.id));
      if (natural) {
        used.add(natural.id);
        return { id: natural.id };
      }
      const wild = wilds.find((card) => !used.has(card.id));
      used.add(wild.id);
      return { id: wild.id, asRank: rank };
    });
  }
  return null;
}

export function inferHit(meld, cards) {
  const specs = [];
  for (const card of cards) {
    if (card.type !== "wild") {
      specs.push({ id: card.id });
      continue;
    }
    if (meld.kind === "set") {
      const rank = meld.cards.map(rankOf).find((value) => value != null);
      if (rank == null) return null;
      specs.push({ id: card.id, asRank: rank });
    } else if (meld.kind === "color") {
      const color =
        meld.cards.find((entry) => entry.type === "number")?.color ??
        meld.cards.find((entry) => entry.asColor != null)?.asColor;
      if (color == null) return null;
      specs.push({ id: card.id, asColor: color });
    } else {
      const ranks = meld.cards.map(rankOf).filter((value) => value != null).sort((a, b) => a - b);
      const high = ranks.at(-1) + 1;
      const low = ranks[0] - 1;
      const asRank = high <= 13 ? high : low;
      if (asRank < 1 || asRank > 13) return null;
      specs.push({ id: card.id, asRank });
    }
  }
  return specs;
}
