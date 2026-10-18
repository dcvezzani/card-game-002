import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  createDeck,
  phaseDef,
  preparePiles,
  scoreHand,
  shuffle,
  validateGroup,
  validateLayDown,
} from "./phase10.js";

function fail(error) {
  return { ok: false, error };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function cleanName(name) {
  const text = String(name ?? "").trim().replace(/\s+/g, " ");
  if (text.length < 1 || text.length > 20) return "";
  if (!/^[\p{L}\p{N} ]+$/u.test(text)) return "";
  return text;
}

function names(room) {
  return [
    ...room.players.filter((player) => !player.left),
    ...room.spectators,
  ].map((person) => person.name.toLowerCase());
}

function seated(room) {
  return room.players.filter((player) => !player.left);
}

function active(room) {
  return room.players.filter((player) => !player.left && !player.waiting);
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) ?? null;
}

const BOT_NAMES = ["Riley", "Quinn", "Avery", "Jules", "Morgan"];

function makePlayer(id, name, waiting) {
  return {
    id,
    name,
    joinedAt: Date.now(),
    connected: true,
    bot: false,
    phase: 1,
    score: 0,
    completed: false,
    hand: [],
    melds: [],
    laidDown: false,
    revealed: false,
    waiting,
    left: false,
    pendingWildId: null,
  };
}

function nextActiveId(room, afterId) {
  const players = active(room);
  if (!players.length) return null;
  const start = players.findIndex((player) => player.id === afterId);
  const index = start === -1 ? 0 : (start + 1) % players.length;
  return players[index].id;
}

function nextHumanId(room, afterId) {
  const players = active(room).filter((player) => !player.bot);
  if (!players.length) return null;
  const start = players.findIndex((player) => player.id === afterId);
  const index = start === -1 ? 0 : (start + 1) % players.length;
  return players[index].id;
}

function seatedHumans(room) {
  return seated(room).filter((player) => !player.bot);
}

function seatedBots(room) {
  return seated(room).filter((player) => player.bot);
}

function promoteSpectators(room) {
  while (seated(room).length < MAX_PLAYERS && room.spectators.length) {
    const spectator = room.spectators.shift();
    room.players.push(makePlayer(spectator.id, spectator.name, room.status === "playing"));
    if (!room.dealerId) room.dealerId = spectator.id;
  }
}

function currentPlayer(room, playerId) {
  if (room.status !== "playing" || room.turnId !== playerId) return null;
  const player = findPlayer(room, playerId);
  if (!player || player.left || player.waiting) return null;
  return player;
}

function assigned(card, spec = {}) {
  const next = { id: card.id, type: card.type };
  if (card.color != null) next.color = card.color;
  if (card.type === "number") {
    next.rank = card.rank;
  } else if (card.type === "wild") {
    const asRank = spec.asRank ?? card.asRank;
    const asColor = spec.asColor ?? card.asColor;
    if (asRank != null && asRank !== "") next.asRank = Number(asRank);
    if (asColor != null && asColor !== "") next.asColor = Number(asColor);
  }
  return next;
}

function publicCard(card) {
  return assigned(card);
}

function takeSpecs(hand, specs) {
  const used = new Set();
  const cards = [];
  for (const spec of specs) {
    if (!spec || used.has(spec.id)) return { error: "That card is not in your hand" };
    const found = hand.find((card) => card.id === spec.id);
    if (!found) return { error: "That card is not in your hand" };
    used.add(spec.id);
    cards.push(assigned(found, spec));
  }
  return { cards, used };
}

function clearTable(room) {
  room.draw = [];
  room.discard = [];
  room.turnId = null;
  room.step = null;
  room.roundResult = null;
  for (const player of room.players) {
    player.hand = [];
    player.melds = [];
    player.laidDown = false;
    player.pendingWildId = null;
    player.waiting = false;
  }
}

export function createRoom(random = Math.random) {
  return {
    status: "lobby",
    players: [],
    spectators: [],
    dealerId: null,
    turnId: null,
    step: null,
    draw: [],
    discard: [],
    chat: [],
    roundResult: null,
    winnerId: null,
    random,
  };
}

export function join(room, { playerId, name }) {
  if (typeof playerId !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(playerId)) {
    return fail("Missing player");
  }
  const existing = findPlayer(room, playerId);
  if (existing && !existing.left) {
    existing.connected = true;
    return ok({ playerId, rejoined: true });
  }
  const watching = room.spectators.find((spectator) => spectator.id === playerId);
  if (watching) {
    watching.connected = true;
    return ok({ playerId, spectator: true, rejoined: true });
  }
  if (existing?.left) return fail("You already left this round");

  const cleaned = cleanName(name);
  if (!cleaned) return fail("Enter a name using letters and numbers");
  if (names(room).includes(cleaned.toLowerCase())) return fail("That name is taken");

  if (seated(room).length >= MAX_PLAYERS) {
    room.spectators.push({
      id: playerId,
      name: cleaned,
      joinedAt: Date.now(),
      connected: true,
    });
    return ok({ playerId, spectator: true });
  }

  const waiting = room.status === "playing";
  room.players.push(makePlayer(playerId, cleaned, waiting));
  if (!room.dealerId) room.dealerId = playerId;
  return ok({ playerId, waiting });
}

export function leave(room, playerId) {
  const spectatorIndex = room.spectators.findIndex((spectator) => spectator.id === playerId);
  if (spectatorIndex >= 0) {
    room.spectators.splice(spectatorIndex, 1);
    return ok();
  }
  const player = findPlayer(room, playerId);
  if (!player || player.left) return fail("You are not at the table");

  if (room.status !== "playing") {
    room.players = room.players.filter((entry) => entry.id !== playerId);
    if (room.dealerId === playerId) {
      room.dealerId = room.players.find((entry) => !entry.left && !entry.bot)?.id ?? null;
    }
    promoteSpectators(room);
    return ok();
  }

  player.left = true;
  player.connected = false;
  player.hand = [];
  player.pendingWildId = null;
  if (room.turnId === playerId) {
    room.turnId = nextActiveId(room, playerId);
    room.step = "draw";
  }
  if (room.dealerId === playerId) {
    room.dealerId = active(room).find((entry) => !entry.bot)?.id ?? null;
  }
  const humansLeft = active(room).some((entry) => !entry.bot);
  if (active(room).length < MIN_PLAYERS || !humansLeft) {
    room.status = "lobby";
    room.winnerId = null;
    clearTable(room);
    room.players = room.players.filter((entry) => !entry.left);
    if (!room.players.some((entry) => entry.id === room.dealerId && !entry.bot)) {
      room.dealerId = room.players.find((entry) => !entry.bot)?.id ?? null;
    }
  }
  promoteSpectators(room);
  return ok();
}

function resetScores(room) {
  for (const player of room.players) {
    player.phase = 1;
    player.score = 0;
    player.completed = false;
  }
  room.winnerId = null;
}

function seatedHuman(room, playerId) {
  const player = findPlayer(room, playerId);
  if (!player || player.left || player.bot) return null;
  return player;
}

function dealRound(room) {
  const players = seated(room);
  for (const player of players) {
    player.waiting = false;
    player.melds = [];
    player.laidDown = false;
    player.pendingWildId = null;
    player.hand = [];
  }

  const deck = shuffle(createDeck(), room.random);
  const piles = preparePiles(deck, players.length);
  players.forEach((player, index) => {
    player.hand = piles.hands[index];
  });
  room.draw = piles.draw;
  room.discard = piles.discard;
  room.status = "playing";
  room.roundResult = null;
  room.winnerId = null;
  room.turnId = nextActiveId(room, room.dealerId);
  room.step = "draw";
  return ok();
}

export function startRound(room, playerId) {
  if (room.status === "playing") return fail("A round is already going");
  if (room.dealerId !== playerId) return fail("The dealer starts the round");
  if (seated(room).length < MIN_PLAYERS) return fail("Need at least two players");
  if (room.status === "gameOver") resetScores(room);
  return dealRound(room);
}

export function endGame(room, playerId) {
  if (!seatedHuman(room, playerId)) return fail("Sit down to end the game");
  if (room.status === "lobby") return fail("No game is going");
  resetScores(room);
  clearTable(room);
  room.status = "lobby";
  return ok();
}

export function newGame(room, playerId) {
  if (!seatedHuman(room, playerId)) return fail("Sit down to start a game");
  if (seated(room).length < MIN_PLAYERS) return fail("Need at least two players");
  resetScores(room);
  clearTable(room);
  room.status = "lobby";
  return dealRound(room);
}

function refillDraw(room) {
  if (room.draw.length || room.discard.length < 2) return;
  const top = room.discard.pop();
  room.draw = shuffle(room.discard, room.random);
  room.discard = [top];
}

export function draw(room, playerId, source) {
  const player = currentPlayer(room, playerId);
  if (!player) return fail("It isn't your turn");
  if (room.step !== "draw") return fail("You already drew");

  if (source === "discard") {
    const top = room.discard[room.discard.length - 1];
    if (!top) return fail("The discard pile is empty");
    if (top.type === "skip") return fail("You cannot pick up a Skip");
    player.hand.push(room.discard.pop());
  } else if (source === "draw") {
    refillDraw(room);
    if (!room.draw.length) return fail("No cards left to draw");
    player.hand.push(room.draw.pop());
  } else {
    return fail("Draw from the draw pile or the discard pile");
  }

  room.step = "action";
  return ok();
}

function finishRound(room, wentOutId) {
  const rows = [];
  const completers = [];
  for (const player of active(room)) {
    const points = player.id === wentOutId ? 0 : scoreHand(player.hand);
    player.score += points;
    let advanced = false;
    let completed = false;
    if (player.laidDown) {
      if (player.phase >= 10) {
        completed = true;
        player.completed = true;
        completers.push(player);
      } else {
        player.phase += 1;
        advanced = true;
      }
    }
    rows.push({
      id: player.id,
      name: player.name,
      points,
      total: player.score,
      advanced,
      completed,
    });
  }

  const wentOut = findPlayer(room, wentOutId);
  room.roundResult = {
    wentOutId,
    wentOutName: wentOut?.name ?? "",
    rows,
  };
  room.turnId = null;
  room.step = null;
  room.draw = [];

  if (completers.length) {
    completers.sort((a, b) => a.score - b.score || (a.id === wentOutId ? -1 : 1));
    room.status = "gameOver";
    room.winnerId = completers[0].id;
    room.roundResult.winnerId = completers[0].id;
    room.roundResult.winnerName = completers[0].name;
  } else {
    room.status = "roundEnd";
    room.dealerId = nextHumanId(room, room.dealerId) ?? room.dealerId;
  }
}

function botId(number) {
  return `bot-${String(number).padStart(4, "0")}`;
}

export function setBotCount(room, playerId, count) {
  if (room.status === "playing") return fail("Wait until the round ends");
  if (room.dealerId !== playerId) return fail("The dealer sets the AI players");
  const dealer = findPlayer(room, playerId);
  if (!dealer || dealer.left || dealer.bot) return fail("The dealer sets the AI players");
  if (typeof count !== "number" || !Number.isInteger(count)) return fail("Choose how many AI players");
  if (seatedHumans(room).length < 1) return fail("A human has to sit at the table");

  const limit = MAX_PLAYERS - seatedHumans(room).length;
  const next = Math.max(0, Math.min(limit, count));
  const current = seatedBots(room);
  const taken = new Set(names(room));
  const namePool = BOT_NAMES.filter((candidate) => !taken.has(candidate.toLowerCase()));
  if (next > current.length && namePool.length < next - current.length) {
    return fail("No chair left for an AI player");
  }
  if (next < current.length) {
    const dropIds = new Set(current.slice(next).map((player) => player.id));
    room.players = room.players.filter((player) => !dropIds.has(player.id));
    promoteSpectators(room);
  }

  while (seatedBots(room).length < next) {
    let id = null;
    for (let number = 1; number <= MAX_PLAYERS; number += 1) {
      const candidate = botId(number);
      if (!room.players.some((player) => player.id === candidate)) {
        id = candidate;
        break;
      }
    }
    const name = namePool.find((candidate) => !taken.has(candidate.toLowerCase()));
    if (!id || !name) return fail("No chair left for an AI player");
    taken.add(name.toLowerCase());
    const bot = makePlayer(id, name, false);
    bot.bot = true;
    room.players.push(bot);
  }
  return ok({ count: seatedBots(room).length });
}

export function discard(room, playerId, cardId) {
  const player = currentPlayer(room, playerId);
  if (!player) return fail("It isn't your turn");
  if (room.step !== "action") return fail("Draw a card first");
  if (player.pendingWildId) return fail("Play the Wild before you discard");
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index < 0) return fail("That card is not in your hand");

  const [card] = player.hand.splice(index, 1);
  room.discard.push({ id: card.id, type: card.type, color: card.color, rank: card.rank });
  if (player.hand.length === 0) {
    finishRound(room, player.id);
    return ok();
  }

  let next = nextActiveId(room, player.id);
  if (card.type === "skip" && next) next = nextActiveId(room, next);
  room.turnId = next;
  room.step = "draw";
  return ok();
}

export function reorder(room, playerId, cardIds) {
  const player = findPlayer(room, playerId);
  if (!player || player.left || player.waiting) return fail("You are not holding cards");
  if (!Array.isArray(cardIds) || cardIds.length !== player.hand.length) {
    return fail("Reorder the whole hand");
  }
  if (new Set(cardIds).size !== cardIds.length) return fail("Reorder the whole hand");
  const byId = new Map(player.hand.map((card) => [card.id, card]));
  const next = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    if (!card) return fail("Reorder the whole hand");
    next.push(card);
  }
  player.hand = next;
  return ok();
}

export function reveal(room, playerId) {
  const player = findPlayer(room, playerId);
  if (!player || player.left) return fail("You are not at the table");
  player.revealed = true;
  return ok();
}

export function hide(room, playerId) {
  const player = findPlayer(room, playerId);
  if (!player || player.left) return fail("You are not at the table");
  player.revealed = false;
  return ok();
}

export function layDown(room, playerId, groups) {
  const player = currentPlayer(room, playerId);
  if (!player) return fail("It isn't your turn");
  if (room.step !== "action") return fail("Draw a card first");
  if (player.laidDown) return fail("You already laid down your phase");
  if (player.pendingWildId) return fail("Play the Wild before you do that");
  if (!Array.isArray(groups)) return fail("Choose groups for your phase");

  const built = [];
  const used = new Set();
  for (const group of groups) {
    const taken = takeSpecs(player.hand, group);
    if (taken.error) return fail(taken.error);
    for (const id of taken.used) {
      if (used.has(id)) return fail("A card can only be in one group");
      used.add(id);
    }
    built.push(taken.cards);
  }
  if (used.size >= player.hand.length) return fail("Keep a card to discard");

  const error = validateLayDown(player.phase, built);
  if (error) return fail(error);

  player.hand = player.hand.filter((card) => !used.has(card.id));
  const specs = phaseDef(player.phase).groups;
  player.melds = built.map((cards, index) => ({
    kind: specs[index].kind,
    min: specs[index].count,
    cards,
  }));
  player.laidDown = true;
  return ok();
}

export function hit(room, playerId, { ownerId, meldIndex, cards }) {
  const player = currentPlayer(room, playerId);
  if (!player) return fail("It isn't your turn");
  if (room.step !== "action") return fail("Draw a card first");
  if (!player.laidDown) return fail("Lay down your phase first");
  const owner = findPlayer(room, ownerId);
  const meld = owner?.melds?.[meldIndex];
  if (!meld) return fail("That meld is not on the table");
  if (!Array.isArray(cards) || !cards.length) return fail("Choose cards to hit with");

  const taken = takeSpecs(player.hand, cards);
  if (taken.error) return fail(taken.error);
  if (player.hand.length - taken.cards.length < 1) return fail("Keep a card to discard");

  const error = validateGroup(meld.kind, meld.cards.concat(taken.cards), meld.min);
  if (error) return fail(error);

  player.hand = player.hand.filter((card) => !taken.used.has(card.id));
  meld.cards = meld.cards.concat(taken.cards);
  if (taken.used.has(player.pendingWildId)) player.pendingWildId = null;
  return ok();
}

export function replaceWild(room, playerId, body) {
  const player = currentPlayer(room, playerId);
  if (!player) return fail("It isn't your turn");
  if (room.step !== "action") return fail("Draw a card first");
  if (!player.laidDown) return fail("Lay down your phase first");

  const sourceOwner = findPlayer(room, body.ownerId);
  const destOwner = findPlayer(room, body.destinationOwnerId);
  const source = sourceOwner?.melds?.[body.meldIndex];
  const dest = destOwner?.melds?.[body.destinationIndex];
  if (!source || !dest) return fail("That meld is not on the table");
  if (sourceOwner.id === destOwner.id && body.meldIndex === body.destinationIndex) {
    return fail("Play the Wild on a different meld");
  }

  const wild = source.cards.find((card) => card.id === body.wildCardId && card.type === "wild");
  const natural = player.hand.find((card) => card.id === body.naturalCardId && card.type === "number");
  if (!wild || !natural) return fail("Choose a Wild and the card it stands for");
  if (natural.rank !== wild.asRank) return fail("That card does not match the Wild");
  if (source.kind === "color" && natural.color !== wild.asColor) {
    return fail("That card does not match the color");
  }
  if (player.hand.length < 2) return fail("Keep a card to discard");

  const sourceCards = source.cards
    .filter((card) => card.id !== wild.id)
    .concat([{ id: natural.id, type: "number", color: natural.color, rank: natural.rank }]);
  const replay = { id: wild.id, type: "wild" };
  if (body.asRank != null && body.asRank !== "") replay.asRank = Number(body.asRank);
  if (body.asColor != null && body.asColor !== "") replay.asColor = Number(body.asColor);
  const destCards = dest.cards.concat([replay]);

  const sourceError = validateGroup(source.kind, sourceCards, source.min);
  if (sourceError) return fail(sourceError);
  const destError = validateGroup(dest.kind, destCards, dest.min);
  if (destError) return fail(destError);

  player.hand = player.hand.filter((card) => card.id !== natural.id);
  source.cards = sourceCards;
  dest.cards = destCards;
  return ok();
}

export function chat(room, playerId, text) {
  const player = findPlayer(room, playerId);
  const spectator = room.spectators.find((entry) => entry.id === playerId);
  const who = player && !player.left ? player : spectator;
  if (!who) return fail("Join the table to chat");
  const message = String(text ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (!message) return fail("Say something");
  room.chat.push({
    id: `${Date.now()}-${playerId}-${room.chat.length}`,
    playerId,
    name: who.name,
    text: message,
    at: Date.now(),
  });
  if (room.chat.length > 80) room.chat.splice(0, room.chat.length - 80);
  return ok();
}

export function disconnect(room, playerId) {
  const player = findPlayer(room, playerId);
  if (player) player.connected = false;
  const spectator = room.spectators.find((entry) => entry.id === playerId);
  if (spectator) spectator.connected = false;
}

export function viewFor(room, viewerId) {
  const viewer = findPlayer(room, viewerId);
  const spectator = room.spectators.find((entry) => entry.id === viewerId);
  const self = viewer && !viewer.left ? viewer : null;

  return {
    you: self
      ? { id: self.id, name: self.name, spectator: false, waiting: self.waiting }
      : spectator
        ? { id: spectator.id, name: spectator.name, spectator: true, waiting: true }
        : null,
    status: room.status,
    step: room.step,
    turnId: room.turnId,
    dealerId: room.dealerId,
    winnerId: room.winnerId,
    drawCount: room.draw.length,
    discardCount: room.discard.length,
    discardTop: room.discard.length ? publicCard(room.discard[room.discard.length - 1]) : null,
    botCount: room.players.filter((player) => player.bot && !player.left).length,
    botLimit: MAX_PLAYERS - room.players.filter((player) => !player.bot && !player.left).length,
    chat: room.chat.slice(-80),
    roundResult: room.roundResult,
    players: room.players
      .filter((player) => !player.left || player.melds.length)
      .map((player) => {
        const showHand = self?.id === player.id || (player.revealed && !player.left);
        return {
          id: player.id,
          name: player.name,
          bot: Boolean(player.bot),
          joinedAt: player.joinedAt,
          phase: player.phase,
          score: player.score,
          connected: player.connected,
          waiting: player.waiting,
          left: player.left,
          revealed: player.revealed,
          laidDown: player.laidDown,
          isTurn: player.id === room.turnId,
          isDealer: player.id === room.dealerId,
          handCount: player.hand.length,
          hand: showHand ? player.hand.map(publicCard) : null,
          melds: player.melds.map((meld) => ({
            kind: meld.kind,
            min: meld.min,
            cards: meld.cards.map(publicCard),
          })),
        };
      }),
    spectators: room.spectators.map((entry) => ({
      id: entry.id,
      name: entry.name,
      joinedAt: entry.joinedAt,
    })),
  };
}
