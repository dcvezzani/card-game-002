import assert from "node:assert/strict";
import test from "node:test";
import { BLACK, cropForCard } from "../lib/spriteMap.js";
import {
  SKIP_COUNT,
  WILD_COUNT,
  buryStarterSkip,
  cardScore,
  createDeck,
  deckNumberColors,
  phaseDef,
  preparePiles,
  scoreHand,
  shuffle,
  validateGroup,
  validateLayDown,
} from "../lib/phase10.js";
import {
  chat,
  createRoom,
  discard,
  draw,
  hide,
  hit,
  join,
  layDown,
  leave,
  reorder,
  replaceWild,
  reveal,
  startRound,
  viewFor,
} from "../lib/room.js";

function number(id, rank, color = 0) {
  return { id, type: "number", color, rank };
}

function wild(id, asRank, asColor) {
  const card = { id, type: "wild" };
  if (asRank != null) card.asRank = asRank;
  if (asColor != null) card.asColor = asColor;
  return card;
}

test("deck uses the configured colors, plus wilds and skips in black", () => {
  const deck = createDeck();
  const colors = deckNumberColors();
  const numbers = deck.filter((card) => card.type === "number");
  assert.equal(deck.length, colors.length * 13 + WILD_COUNT + SKIP_COUNT);
  assert.equal(colors.length, 4);
  assert.deepEqual(
    [...new Set(numbers.map((card) => card.color))].sort((a, b) => a - b),
    colors.map((color) => color.id).sort((a, b) => a - b),
  );
  assert.equal(deck.filter((card) => card.type === "wild").length, 8);
  assert.equal(deck.filter((card) => card.type === "skip").length, 4);
  for (const card of deck.filter((entry) => entry.type === "wild" || entry.type === "skip")) {
    assert.equal(card.color, BLACK.id);
  }
  assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
  const numberFace = cropForCard(number("n", 1));
  const wildFace = cropForCard(wild("w"));
  const skipFace = cropForCard({ type: "skip" });
  assert.equal(wildFace.w, numberFace.w);
  assert.equal(wildFace.h, numberFace.h);
  assert.equal(skipFace.w, numberFace.w);
  assert.equal(skipFace.h, numberFace.h);
  assert.equal(wildFace.x, 13 * numberFace.w);
  assert.equal(skipFace.x, 14 * numberFace.w);
  assert.equal(wildFace.y, 0);
  assert.equal(skipFace.y, 0);
  assert.equal(numberFace.y, numberFace.h);
});

test("scores follow Phase 10 values, with 13 scoring like 10–12", () => {
  assert.equal(cardScore(number("a", 5)), 5);
  assert.equal(cardScore(number("b", 9)), 5);
  assert.equal(cardScore(number("c", 10)), 10);
  assert.equal(cardScore(number("d", 13)), 10);
  assert.equal(cardScore({ type: "skip" }), 15);
  assert.equal(cardScore({ type: "wild" }), 25);
  assert.equal(scoreHand([number("a", 5), { type: "wild" }, { type: "skip" }]), 45);
});

test("sets, runs, and colors accept wilds and reject skips", () => {
  assert.equal(validateGroup("set", [number("a", 7), number("b", 7, 1), wild("w", 7)], 3), null);
  assert.match(validateGroup("set", [number("a", 7), number("b", 8)], 2), /share one rank/);
  assert.match(validateGroup("set", [wild("w")], 1), /needs a rank/);
  assert.equal(
    validateGroup("run", [number("a", 4), wild("w", 5), number("b", 6)], 3),
    null,
  );
  assert.match(validateGroup("run", [number("a", 4), number("b", 6)], 2), /consecutive/);
  assert.equal(
    validateGroup(
      "color",
      [number("a", 1, 3), number("b", 4, 3), wild("w", null, 3)],
      3,
    ),
    null,
  );
  assert.match(validateGroup("set", [{ type: "skip" }, number("a", 1), number("b", 1)], 3), /Skip/);
});

test("phase 1 allows a larger set and requires both groups", () => {
  const groups = [
    [number("a", 2), number("b", 2, 1), number("c", 2, 2), number("d", 2, 3)],
    [number("e", 9), number("f", 9, 1), number("g", 9, 2)],
  ];
  assert.equal(validateLayDown(1, groups), null);
  assert.match(validateLayDown(1, [groups[0]]), /2 groups/);
  assert.equal(phaseDef(8).groups[0].kind, "color");
});

test("a starter Skip is buried under the deck", () => {
  const numbers = createDeck().filter((card) => card.type === "number").slice(0, 20);
  const skip = createDeck().find((card) => card.type === "skip");
  const under = number("under", 3, 4);
  const piles = preparePiles([under, skip, ...numbers], 2);
  assert.equal(piles.discard[0].id, "under");
  assert.equal(piles.hands[0].length, 10);
  assert.equal(piles.hands[1].length, 10);
  assert.ok(buryStarterSkip([number("a", 1), skip]).at(-1).type !== "skip");
});

function sit(room, id, name) {
  const result = join(room, { playerId: id, name });
  assert.equal(result.ok, true, result.error);
  return result;
}

test("a round deals ten cards and hides the other hand", () => {
  const room = createRoom(() => 0.25);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-bbb", "Bo");
  assert.equal(startRound(room, "player-bbb").ok, false);
  assert.equal(startRound(room, "player-aaa").ok, true);
  assert.equal(room.players[0].hand.length, 10);
  assert.notEqual(room.discard[0].type, "skip");
  assert.equal(room.step, "draw");
  assert.notEqual(room.turnId, room.dealerId);

  const outsider = viewFor(room, "player-bbb");
  const hidden = outsider.players.find((player) => player.id === "player-aaa");
  assert.equal(hidden.hand, null);
  assert.equal(hidden.handCount, 10);
  const visible = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "number" || value.type === "wild" || value.type === "skip") visible.push(value.id);
    for (const child of Object.values(value)) walk(child);
  };
  walk(outsider);
  for (const card of room.players[0].hand) assert.equal(visible.includes(card.id), false);
  assert.equal(outsider.drawCount, room.draw.length);
  assert.equal("draw" in outsider, false);

  const own = viewFor(room, "player-aaa");
  assert.equal(own.players.find((player) => player.id === "player-aaa").hand.length, 10);
});

test("draw, lay down, hit, skip, and go out score the round", () => {
  const room = createRoom(() => 0.1);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-bbb", "Bo");
  sit(room, "player-ccc", "Cy");
  startRound(room, "player-aaa");
  const ada = room.players[0];
  const bo = room.players[1];
  const cy = room.players[2];
  room.turnId = ada.id;
  room.step = "draw";

  assert.match(discard(room, ada.id, ada.hand[0].id).error, /Draw/);
  room.discard.push({ id: "s0", type: "skip" });
  assert.match(draw(room, ada.id, "discard").error, /Skip/);
  room.discard.pop();
  assert.equal(draw(room, ada.id, "draw").ok, true);
  assert.equal(room.step, "action");

  ada.hand = [
    number("a1", 4, 0),
    number("a2", 4, 1),
    number("a3", 4, 2),
    number("b1", 8, 0),
    number("b2", 8, 1),
    number("b3", 8, 2),
    number("hit", 4, 3),
    wild("wild-1"),
    { id: "skip-1", type: "skip" },
    number("last", 1, 5),
  ];
  assert.match(
    layDown(room, ada.id, [
      [number("a1", 4), number("a2", 4), number("a3", 4), number("hit", 4), number("b1", 8)],
    ]).error,
    /groups/,
  );
  assert.equal(
    layDown(room, ada.id, [
      [
        { id: "a1" },
        { id: "a2" },
        { id: "a3" },
      ],
      [
        { id: "b1" },
        { id: "b2" },
        { id: "b3" },
      ],
    ]).ok,
    true,
  );
  assert.equal(hit(room, ada.id, {
    ownerId: ada.id,
    meldIndex: 0,
    cards: [{ id: "hit" }],
  }).ok, true);
  assert.equal(ada.melds[0].cards.length, 4);

  bo.melds = [{
    kind: "set",
    min: 3,
    cards: [number("c1", 6, 0), number("c2", 6, 1), wild("wild-bo", 6)],
  }];
  bo.laidDown = true;
  assert.equal(replaceWild(room, ada.id, {
    ownerId: bo.id,
    meldIndex: 0,
    wildCardId: "wild-bo",
    naturalCardId: "missing",
    destinationOwnerId: ada.id,
    destinationIndex: 0,
    asRank: 4,
  }).ok, false);

  ada.hand.push(number("six", 6, 4));
  assert.equal(replaceWild(room, ada.id, {
    ownerId: bo.id,
    meldIndex: 0,
    wildCardId: "wild-bo",
    naturalCardId: "six",
    destinationOwnerId: ada.id,
    destinationIndex: 0,
    asRank: 4,
  }).ok, true);
  assert.equal(bo.melds[0].cards.some((card) => card.id === "six"), true);
  assert.equal(ada.melds[0].cards.some((card) => card.id === "wild-bo"), true);

  assert.equal(discard(room, ada.id, "skip-1").ok, true);
  assert.equal(room.turnId, cy.id);

  room.turnId = ada.id;
  room.step = "action";
  ada.hand = [number("last", 1, 5)];
  const before = bo.score;
  assert.equal(discard(room, ada.id, "last").ok, true);
  assert.equal(room.status, "roundEnd");
  assert.equal(room.roundResult.wentOutId, ada.id);
  assert.equal(ada.phase, 2);
  assert.ok(bo.score > before);
  assert.equal(room.roundResult.rows.find((row) => row.id === ada.id).points, 0);
});

test("phase 10 ends the game for the lowest score", () => {
  const room = createRoom(() => 0.2);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-bbb", "Bo");
  startRound(room, "player-aaa");
  const ada = room.players[0];
  const bo = room.players[1];
  ada.phase = 10;
  bo.phase = 10;
  ada.laidDown = true;
  bo.laidDown = true;
  ada.score = 40;
  bo.score = 10;
  ada.hand = [];
  bo.hand = [number("x", 3)];
  room.turnId = ada.id;
  room.step = "action";
  ada.hand = [{ id: "bye", type: "skip" }];
  discard(room, ada.id, "bye");
  assert.equal(room.status, "gameOver");
  assert.equal(room.winnerId, bo.id);
  assert.equal(ada.phase, 10);
});

test("empty draw pile reshuffles the discard except its top card", () => {
  const room = createRoom(() => 0);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-bbb", "Bo");
  startRound(room, "player-aaa");
  const ada = room.players.find((player) => player.id === room.turnId);
  room.draw = [];
  room.discard = [number("buried", 2), number("top", 9)];
  assert.equal(draw(room, ada.id, "draw").ok, true);
  assert.equal(room.discard.length, 1);
  assert.equal(room.discard[0].id, "top");
  assert.equal(ada.hand.at(-1).id, "buried");
});

test("reveal, reorder, chat, and leave keep private cards private", () => {
  const room = createRoom(() => 0.3);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-bbb", "Bo");
  sit(room, "player-ccc", "Cy");
  startRound(room, "player-aaa");
  const ada = room.players[0];
  const order = ada.hand.map((card) => card.id).reverse();
  assert.equal(reorder(room, ada.id, order).ok, true);
  assert.deepEqual(ada.hand.map((card) => card.id), order);

  reveal(room, ada.id);
  const opened = viewFor(room, "player-bbb");
  assert.equal(opened.players.find((player) => player.id === ada.id).hand.length, 10);
  hide(room, ada.id);
  assert.equal(viewFor(room, "player-bbb").players.find((player) => player.id === ada.id).hand, null);

  assert.equal(chat(room, "player-bbb", "  Ready when you are. ").ok, true);
  assert.equal(room.chat.at(-1).text, "Ready when you are.");

  ada.melds = [{ kind: "set", min: 3, cards: [number("a", 1), number("b", 1), number("c", 1)] }];
  assert.equal(leave(room, ada.id).ok, true);
  assert.equal(ada.left, true);
  assert.equal(ada.melds.length, 1);
  assert.equal(ada.hand.length, 0);
});

test("shuffle keeps every card", () => {
  const deck = createDeck();
  const mixed = shuffle(deck, () => 0.5);
  assert.equal(mixed.length, deck.length);
  assert.equal(new Set(mixed.map((card) => card.id)).size, deck.length);
});
