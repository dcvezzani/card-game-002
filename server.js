import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { handOfThirteen } from "./lib/fanEngine.js";
import { mulberry32 } from "./lib/phase10.js";
import {
  chat,
  createRoom,
  discard,
  disconnect,
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
} from "./lib/room.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const SHEET = path.join(__dirname, "dcv", "Color Numbered Card Sheet.png");
const seed = process.env.PHASE10_SEED;
const room = createRoom(seed ? mulberry32(Number(seed)) : Math.random);

const app = express();

app.get("/api/hand", (_req, res) => {
  res.json(handOfThirteen());
});

app.get("/assets/cards.png", (_req, res) => {
  res.sendFile(SHEET);
});

app.use("/lib", express.static(path.join(__dirname, "lib")));
app.use("/config", express.static(path.join(__dirname, "config")));
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const sockets = new Map();

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast() {
  for (const [playerId, ws] of sockets) {
    send(ws, { type: "state", state: viewFor(room, playerId) });
  }
}

function perform(playerId, msg) {
  switch (msg.type) {
    case "start":
      return startRound(room, playerId);
    case "draw":
      return draw(room, playerId, msg.source);
    case "discard":
      return discard(room, playerId, msg.cardId);
    case "reorder":
      return reorder(room, playerId, msg.cardIds);
    case "reveal":
      return reveal(room, playerId);
    case "hide":
      return hide(room, playerId);
    case "layDown":
      return layDown(room, playerId, msg.groups);
    case "hit":
      return hit(room, playerId, msg);
    case "replaceWild":
      return replaceWild(room, playerId, msg);
    case "chat":
      return chat(room, playerId, msg.text);
    default:
      return { ok: false, error: "Unknown action" };
  }
}

wss.on("connection", (ws) => {
  let playerId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "join") {
      const id =
        typeof msg.playerId === "string" && /^[A-Za-z0-9-]{8,80}$/.test(msg.playerId)
          ? msg.playerId
          : crypto.randomUUID();
      const result = join(room, { playerId: id, name: msg.name });
      if (!result.ok) {
        send(ws, { type: "error", message: result.error });
        return;
      }
      playerId = result.playerId;
      const previous = sockets.get(playerId);
      sockets.set(playerId, ws);
      if (previous && previous !== ws) previous.close();
      send(ws, { type: "hello", playerId });
      broadcast();
      return;
    }

    if (!playerId) {
      send(ws, { type: "error", message: "Join the table first" });
      return;
    }

    if (msg.type === "leave") {
      const result = leave(room, playerId);
      sockets.delete(playerId);
      playerId = null;
      if (!result.ok) send(ws, { type: "error", message: result.error });
      else send(ws, { type: "left" });
      broadcast();
      return;
    }

    const result = perform(playerId, msg);
    if (!result.ok) send(ws, { type: "error", message: result.error });
    else broadcast();
  });

  ws.on("close", () => {
    if (playerId && sockets.get(playerId) === ws) {
      disconnect(room, playerId);
      sockets.delete(playerId);
      broadcast();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Phase 10 at http://localhost:${PORT}`);
});
