import assert from "node:assert/strict";
import test from "node:test";
import { chooseAction } from "../lib/ai.js";
import { mulberry32 } from "../lib/phase10.js";
import {
  createRoom,
  discard,
  draw,
  hit,
  join,
  layDown,
  leave,
  replaceWild,
  setBotCount,
  startRound,
  viewFor,
} from "../lib/room.js";

function number(id, rank, color = 0) {
  return { id, type: "number", color, rank };
}

function sit(room, id, name) {
  const result = join(room, { playerId: id, name });
  assert.equal(result.ok, true, result.error);
  return result;
}

function apply(room, playerId, action) {
  if (action.type === "draw") return draw(room, playerId, action.source);
  if (action.type === "discard") return discard(room, playerId, action.cardId);
  if (action.type === "layDown") return layDown(room, playerId, action.groups);
  if (action.type === "hit") return hit(room, playerId, action);
  if (action.type === "replaceWild") return replaceWild(room, playerId, action);
  return { ok: false, error: "Unknown action" };
}

test("the dealer sets the AI count within the free chairs", () => {
  const room = createRoom(() => 0.2);
  sit(room, "player-aaa", "Ada");
  sit(room, "player-rrr", "Riley");
  assert.match(setBotCount(room, "player-rrr", 1).error, /dealer/);
  assert.equal(setBotCount(room, "player-aaa", 1).count, 1);
  assert.equal(room.players.find((player) => player.bot).name, "Quinn");
  assert.equal(setBotCount(room, "player-aaa", 0).count, 0);
  leave(room, "player-rrr");

  assert.equal(setBotCount(room, "player-aaa", 9).count, 5);
  assert.equal(room.players.filter((player) => player.bot).length, 5);
  assert.equal(room.players.find((player) => player.bot).name, "Riley");
  assert.equal(viewFor(room, "player-aaa").botCount, 5);
  assert.equal(viewFor(room, "player-aaa").botLimit, 5);
  assert.equal(viewFor(room, "player-aaa").players.find((player) => player.bot).bot, true);

  const watching = sit(room, "player-ccc", "Cy");
  assert.equal(watching.spectator, true);
  assert.equal(setBotCount(room, "player-aaa", 4).count, 4);
  assert.equal(room.players.some((player) => player.id === "player-ccc"), true);
  assert.equal(setBotCount(room, "player-aaa", 0).count, 0);
  assert.equal(room.players.some((player) => player.bot), false);
  leave(room, "player-ccc");

  setBotCount(room, "player-aaa", 2);
  startRound(room, "player-aaa");
  assert.match(setBotCount(room, "player-aaa", 1).error, /round/);

  const human = room.players.find((player) => player.id === "player-aaa");
  human.hand = [number("last", 1)];
  room.turnId = human.id;
  room.step = "action";
  leave(room, human.id);
  assert.equal(room.status, "lobby");
  assert.equal(room.players.some((player) => !player.bot), false);
});

test("a bot lays down a finished phase, then discards", () => {
  const room = createRoom(() => 0.2);
  sit(room, "player-aaa", "Ada");
  setBotCount(room, "player-aaa", 1);
  startRound(room, "player-aaa");
  const bot = room.players.find((player) => player.bot);
  bot.phase = 1;
  bot.hand = [
    number("a1", 4, 0),
    number("a2", 4, 1),
    number("a3", 4, 2),
    number("b1", 8, 0),
    number("b2", 8, 1),
    number("b3", 8, 2),
    number("junk", 1, 0),
  ];
  room.turnId = bot.id;
  room.step = "action";

  const lay = chooseAction(viewFor(room, bot.id));
  assert.equal(lay.type, "layDown");
  assert.equal(layDown(room, bot.id, lay.groups).ok, true);
  assert.equal(bot.laidDown, true);

  const thrown = chooseAction(viewFor(room, bot.id));
  assert.equal(thrown.type, "discard");
  assert.equal(thrown.cardId, "junk");
  assert.equal(discard(room, bot.id, thrown.cardId).ok, true);
});

test("a bot takes a discard that completes a set and leaves a Skip", () => {
  const room = createRoom(() => 0.2);
  sit(room, "player-aaa", "Ada");
  setBotCount(room, "player-aaa", 1);
  startRound(room, "player-aaa");
  const bot = room.players.find((player) => player.bot);
  bot.hand = [
    number("s1", 7, 0),
    number("s2", 7, 1),
    number("t1", 9, 0),
    number("t2", 9, 1),
    number("t3", 9, 2),
    number("u1", 2, 0),
    number("u2", 3, 1),
    number("u3", 4, 2),
    number("u4", 5, 3),
    number("u5", 6, 0),
  ];
  room.turnId = bot.id;
  room.step = "draw";
  room.discard.push(number("s3", 7, 2));

  const view = viewFor(room, bot.id);
  assert.equal(view.players.find((player) => player.id === "player-aaa").hand, null);
  assert.ok(view.players.find((player) => player.id === bot.id).hand.length);
  assert.equal(chooseAction(view).source, "discard");

  room.discard.push({ id: "s0", type: "skip", color: 4 });
  assert.equal(chooseAction(viewFor(room, bot.id)).source, "draw");
});

test("a bot turn draws and then plays out on legal actions", () => {
  const room = createRoom(mulberry32(3));
  sit(room, "player-aaa", "Ada");
  setBotCount(room, "player-aaa", 1);
  startRound(room, "player-aaa");
  const bot = room.players.find((player) => player.bot);
  assert.equal(room.turnId, bot.id);
  assert.equal(room.step, "draw");

  let steps = 0;
  while (room.status === "playing" && room.turnId === bot.id) {
    const view = viewFor(room, bot.id);
    assert.equal(view.players.find((player) => player.id === "player-aaa").hand, null);
    const action = chooseAction(view);
    const result = apply(room, bot.id, action);
    assert.equal(result.ok, true, `${action.type}: ${result.error}`);
    steps += 1;
    assert.ok(steps < 30);
  }
  assert.ok(steps >= 2);
});

test("the deal stays with a human when a bot sits between players", () => {
  const room = createRoom(() => 0.4);
  sit(room, "player-aaa", "Ada");
  setBotCount(room, "player-aaa", 1);
  sit(room, "player-bbb", "Bo");
  startRound(room, "player-aaa");
  const ada = room.players.find((player) => player.id === "player-aaa");
  ada.hand = [number("last", 3)];
  room.turnId = ada.id;
  room.step = "action";
  assert.equal(discard(room, ada.id, "last").ok, true);
  assert.equal(room.status, "roundEnd");
  assert.equal(room.dealerId, "player-bbb");
  assert.equal(room.players.find((player) => player.id === room.dealerId).bot, false);
});
