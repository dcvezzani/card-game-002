import { phaseDef } from "/lib/phase10.js";
import { avatarUrl, loadSheet, miniCard } from "./cards.js";
import { createHand } from "./hand.js";
import { assignGroup, groupLabel, inferHit } from "./melds.js";

const hand = createHand(document.querySelector("#hand"));
const tableEl = document.querySelector("#table");
const actionsEl = document.querySelector("#actions");
const modalActionsEl = document.querySelector("#modal-actions");
const phaseLineEl = document.querySelector("#phase-line");
const botsEl = document.querySelector("#bots");
const botsCountEl = document.querySelector("#bots-count");
const botsLessEl = document.querySelector("#bots-less");
const botsMoreEl = document.querySelector("#bots-more");
const resultEl = document.querySelector("#round-result");
const chatLogEl = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const statusEl = document.querySelector("#status");
const tableControlsEl = document.querySelector("#table-controls");
const endGameEl = document.querySelector("#end-game");
const newGameEl = document.querySelector("#new-game");
const youChip = document.querySelector("#you-chip");
const handDialog = document.querySelector("#hand-modal");
const handStage = document.querySelector("#hand-stage");
const handDock = document.querySelector("#hand-dock");
const layTrays = document.querySelector("#lay-trays");
const layConfirm = document.querySelector("#lay-confirm");
const handTitle = document.querySelector("#hand-modal-title");
const statsDialog = document.querySelector("#stats-modal");
const statsBody = document.querySelector("#stats-body");
const joinDialog = document.querySelector("#join-dialog");
const joinForm = document.querySelector("#join-form");
const joinName = document.querySelector("#join-name");
const toastEl = document.querySelector("#toast");

let socket = null;
let state = null;
let meldPick = null;
let swapArmed = false;
let layMode = false;
let groups = [];
let statsPlayerId = null;
let toastTimer = 0;
let layPending = false;

hand.onReorder((cardIds) => send({ type: "reorder", cardIds }));
hand.onChange(() => renderActions());
hand.onDrop((cardId, drop) => addToGroup(cardId, Number(drop.dataset.drop)));

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function showError(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
}

function me() {
  return state?.players.find((player) => player.id === state.you?.id) ?? null;
}

function myHand() {
  return me()?.hand ?? [];
}

function groupedIds() {
  return new Set(groups.flat().map((card) => card.id));
}

function visibleHand() {
  const hidden = groupedIds();
  return myHand().filter((card) => !hidden.has(card.id));
}

function myTurn() {
  return Boolean(state?.you && state.turnId === state.you.id && !state.you.spectator && !state.you.waiting);
}

function canDraw() {
  return myTurn() && state.step === "draw" && state.status === "playing";
}

function canAct() {
  return myTurn() && state.step === "action" && state.status === "playing";
}

function selectedInHand() {
  const ids = new Set(visibleHand().map((card) => card.id));
  return hand.getSelected().filter((card) => ids.has(card.id));
}

function canDiscard() {
  return canAct() && selectedInHand().length === 1;
}

function canLay() {
  const player = me();
  return canAct() && player && !player.laidDown;
}

function canHit() {
  const player = me();
  return canAct() && player?.laidDown && selectedInHand().length > 0 && meldPick;
}

function canDeal() {
  const player = me();
  if (!player || state.dealerId !== player.id) return false;
  if (state.status !== "lobby" && state.status !== "roundEnd") return false;
  return state.players.filter((entry) => !entry.left).length >= 2;
}

function seatedHere() {
  return Boolean(state.you && !state.you.spectator);
}

function canSetBots() {
  const player = me();
  return Boolean(player && state.dealerId === player.id && state.status !== "playing");
}

function placeHand() {
  const full = handDialog.open;
  const parent = full ? handStage : handDock;
  if (hand.element.parentElement !== parent) parent.append(hand.element);
  hand.fit(parent);
}

function render() {
  if (!state) return;
  renderChip();
  renderTable();
  renderHand();
  renderActions();
  renderPhase();
  renderBots();
  renderTableControls();
  renderResult();
  renderChat();
  statusEl.textContent = statusLine();
  if (statsDialog.open) paintStats();
  if (layMode) renderTrays();
  placeHand();
}

function renderChip() {
  youChip.replaceChildren();
  if (!state.you) return;
  const chip = document.createElement("span");
  chip.className = "player-chip";
  if (myTurn()) chip.classList.add("is-turn");
  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.alt = "";
  avatar.src = avatarUrl(state.you.name);
  chip.append(avatar, document.createTextNode(state.you.name));
  youChip.append(chip);
}

function circle(players, youId) {
  const playing = players.filter((player) => !player.left);
  const gone = players.filter((player) => player.left && player.melds.length);
  const index = playing.findIndex((player) => player.id === youId);
  const ordered = index <= 0 ? playing : playing.slice(index).concat(playing.slice(0, index));
  return ordered.concat(gone);
}

function renderTable() {
  tableEl.replaceChildren();
  const piles = document.createElement("div");
  piles.className = "piles";

  const drawBtn = document.createElement("button");
  drawBtn.type = "button";
  drawBtn.className = "pile";
  drawBtn.disabled = !canDraw() || (state.drawCount === 0 && state.discardCount < 2);
  drawBtn.setAttribute("aria-label", `Draw pile, ${state.drawCount} cards`);
  const back = document.createElement("span");
  back.className = "card-back";
  const count = document.createElement("span");
  count.className = "pile-count";
  count.textContent = String(state.drawCount);
  drawBtn.append(back, count);
  drawBtn.addEventListener("click", () => send({ type: "draw", source: "draw" }));

  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.className = "pile";
  discardBtn.setAttribute("aria-label", `Discard pile, ${state.discardCount} cards`);
  if (state.discardTop) discardBtn.append(miniCard(state.discardTop, 72, 128));
  else {
    const empty = document.createElement("span");
    empty.className = "pile-empty";
    empty.textContent = "Discard";
    discardBtn.append(empty);
  }
  const discardCount = document.createElement("span");
  discardCount.className = "pile-count";
  discardCount.textContent = String(state.discardCount);
  discardBtn.append(discardCount);
  discardBtn.addEventListener("click", () => {
    if (canDraw() && state.discardTop) send({ type: "draw", source: "discard" });
    else if (canDiscard()) send({ type: "discard", cardId: selectedInHand()[0].id });
  });

  piles.append(drawBtn, discardBtn);
  const ring = document.createElement("div");
  ring.className = "deck-ring";
  ring.setAttribute("aria-hidden", "true");
  tableEl.append(ring, piles);

  const people = circle(state.players, state.you?.id);
  people.forEach((player, index) => {
    const seat = document.createElement("div");
    seat.className = "seat";
    if (player.isTurn) seat.classList.add("is-turn");
    if (player.left || !player.connected) seat.classList.add("is-away");
    const angle = Math.PI / 2 - (index / people.length) * Math.PI * 2;
    seat.dataset.angle = String(angle);

    const avatarBtn = document.createElement("button");
    avatarBtn.type = "button";
    avatarBtn.className = "avatar-btn";
    avatarBtn.setAttribute("aria-label", `${player.name}, view stats`);
    const image = document.createElement("img");
    image.src = avatarUrl(player.name);
    image.alt = "";
    avatarBtn.append(image);
    avatarBtn.addEventListener("click", () => openStats(player.id));

    const name = document.createElement("span");
    name.className = "seat-name";
    name.textContent = player.name;

    const meta = document.createElement("span");
    meta.className = "seat-meta";
    const bits = [`Phase ${player.phase}`, String(player.score)];
    if (player.bot) bits.push("AI");
    if (player.isDealer) bits.push("dealer");
    if (player.waiting) bits.push("next round");
    if (player.left) bits.push("left");
    meta.textContent = bits.join(" · ");

    const melds = document.createElement("div");
    melds.className = "seat-melds";
    player.melds.forEach((meld, meldIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "meld";
      if (meldPick?.ownerId === player.id && meldPick.meldIndex === meldIndex) {
        button.classList.add("is-picked");
      }
      button.setAttribute("aria-label", `${player.name} meld ${meldIndex + 1}`);
      for (const card of meld.cards) button.append(miniCard(card, 34, 58));
      button.addEventListener("click", () => onMeld(player.id, meldIndex));
      melds.append(button);
    });

    const shown = document.createElement("div");
    shown.className = "seat-hand";
    if (player.id !== state.you?.id && player.hand) {
      for (const card of player.hand) shown.append(miniCard(card, 28, 48));
    } else if (player.id !== state.you?.id && !player.left && player.handCount) {
      const hidden = document.createElement("span");
      hidden.className = "hidden-count";
      hidden.textContent = `${player.handCount} hidden`;
      shown.append(hidden);
    }

    const info = document.createElement("div");
    info.className = "seat-info";
    info.append(name, meta, shown);
    seat.append(info, avatarBtn, melds);
    tableEl.append(seat);
  });

  if (state.spectators.length) {
    const note = document.createElement("p");
    note.className = "watchers";
    note.textContent = `Watching: ${state.spectators.map((entry) => entry.name).join(", ")}`;
    tableEl.append(note);
  }
  placeSeats();
}

const MELD_CARD_W = 34;
const MELD_SHOW = 18;
const MELD_SHOW_MIN = 10;
const SEAT_GAP = 6;

function boxesMeet(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function boxCorners(box) {
  return [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ];
}

function insideCircle(box, cx, cy, radius) {
  const limit = radius * radius;
  return boxCorners(box).every(([x, y]) => (x - cx) ** 2 + (y - cy) ** 2 <= limit);
}

function clearOfCircle(box, radius) {
  const x = Math.max(box.left, Math.min(0, box.right));
  const y = Math.max(box.top, Math.min(0, box.bottom));
  return x * x + y * y >= radius * radius;
}

function localBox(x, y, width, height) {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function gapBetween(a, b) {
  const dx = Math.max(a.left - b.right, b.left - a.right, 0);
  const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
  return Math.hypot(dx, dy);
}

function padded(box, pad) {
  return {
    left: box.left - pad,
    right: box.right + pad,
    top: box.top - pad,
    bottom: box.bottom + pad,
  };
}

function valueStrip(box, strip) {
  return {
    left: box.left,
    right: box.right,
    top: box.top,
    bottom: Math.min(box.bottom, box.top + strip),
  };
}

export function placeSeats() {
  const arena = tableEl.getBoundingClientRect();
  const piles = tableEl.querySelector(".piles");
  const ring = tableEl.querySelector(".deck-ring");
  if (!arena.width || !piles || !ring) return;
  const tableR = Math.min(arena.width, arena.height) / 2 - 6;
  const pile = piles.getBoundingClientRect();
  const deckR = Math.hypot(pile.width, pile.height) / 2 + 10;
  ring.style.width = `${deckR * 2}px`;
  ring.style.height = `${deckR * 2}px`;
  const deckLimit = deckR + 4;
  const avatarSize = 58;

  const onTable = (box) => insideCircle(box, 0, 0, tableR) && clearOfCircle(box, deckLimit);
  const clearOf = (box, blockers, pad = SEAT_GAP) =>
    blockers.every((blocker) => !boxesMeet(box, padded(blocker, pad)));

  const stackBoxes = (centerX, topY, sizes, step) =>
    sizes.map((size, index) => {
      const top = topY + index * step;
      return {
        left: centerX - size.width / 2,
        right: centerX + size.width / 2,
        top,
        bottom: top + size.height,
      };
    });

  const findStack = (avatar, ux, uy, sizes, step, occupied, allowBodyOverlap) => {
    if (!sizes.length) return { boxes: [], score: 0 };
    const ax = (avatar.left + avatar.right) / 2;
    const ay = (avatar.top + avatar.bottom) / 2;
    const stackH = sizes[0].height + (sizes.length - 1) * step;
    const start = allowBodyOverlap ? -stackH + step : avatarSize / 2 + 2;
    let best = null;
    for (let along = start; along <= 210; along += 4) {
      for (let cross = 0; cross <= 160; cross += 4) {
        for (const dir of cross === 0 ? [0] : [1, -1]) {
          const centerX = ax + ux * along - uy * cross * dir;
          const topY = ay + uy * along + ux * cross * dir;
          const boxes = stackBoxes(centerX, topY, sizes, step);
          if (!boxes.every((box) => onTable(box) && clearOf(box, occupied))) continue;
          if (boxes.some((box) => boxesMeet(valueStrip(box, step), padded(avatar, 2)))) continue;
          if (!allowBodyOverlap && boxes.some((box) => boxesMeet(box, avatar))) continue;
          const midY = topY + stackH / 2;
          const outward = (centerX - ax) * ux + (midY - ay) * uy;
          if (outward < 8) continue;
          const gap = Math.min(...boxes.map((box) => gapBetween(box, avatar)));
          const score = Math.abs(cross) * 0.5 + Math.abs(gap - SEAT_GAP) + (allowBodyOverlap ? 24 : 0);
          if (!best || score < best.score) best = { boxes, score };
        }
      }
      if (best && best.score < 20) return best;
    }
    return best;
  };

  const underAvatar = (avatar, width, height, blockers) => {
    const centerX = (avatar.left + avatar.right) / 2;
    const box = {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: avatar.bottom + SEAT_GAP,
      bottom: avatar.bottom + SEAT_GAP + height,
    };
    const clear = onTable(box) && clearOf(box, blockers) && !boxesMeet(box, avatar);
    return clear ? box : null;
  };

  const underStack = (boxes, width, height, blockers, avatar) => {
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const centerX = (Math.min(...boxes.map((box) => box.left)) + Math.max(...boxes.map((box) => box.right))) / 2;
    const box = {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: bottom + 4,
      bottom: bottom + 4 + height,
    };
    const clear = onTable(box) && clearOf(box, blockers) && boxes.every((meld) => !boxesMeet(box, meld));
    return clear ? box : null;
  };

  const corridor = (a, b) => {
    const ax = (a.left + a.right) / 2;
    const ay = (a.top + a.bottom) / 2;
    const bx = (b.left + b.right) / 2;
    const by = (b.top + b.bottom) / 2;
    return {
      left: Math.min(ax, bx) - 4,
      right: Math.max(ax, bx) + 4,
      top: Math.min(ay, by) - 4,
      bottom: Math.max(ay, by) + 4,
    };
  };

  const applyInfoSize = (infoEl, px) => {
    const size = px ? `${px}px` : "";
    infoEl.style.fontSize = size;
    for (const node of infoEl.querySelectorAll(".seat-name, .seat-meta, .hidden-count")) {
      node.style.fontSize = size;
    }
  };

  const shift = (el, box, width, height) => {
    const left = box.left + (box.right - box.left - width) / 2;
    const top = box.top + (box.bottom - box.top - height) / 2;
    el.style.transform = `translate(${left}px, ${top}px)`;
  };

  const occupied = [];
  const seats = [...tableEl.querySelectorAll(".seat")].sort(
    (a, b) => b.querySelectorAll(".meld").length - a.querySelectorAll(".meld").length,
  );

  for (const seat of seats) {
    const angle = Number(seat.dataset.angle);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const info = seat.querySelector(".seat-info");
    const avatarEl = seat.querySelector(".avatar-btn");
    const meldEls = [...seat.querySelector(".seat-melds").querySelectorAll(".meld")];
    info.hidden = false;
    const labelSizes = [0, 13, 12, 11, 10].map((px) => {
      applyInfoSize(info, px);
      const rect = info.getBoundingClientRect();
      return { px, width: rect.width, height: rect.height };
    });
    applyInfoSize(info, 0);

    let placed = null;
    for (let show = meldEls.length ? MELD_SHOW : MELD_SHOW_MIN; show >= MELD_SHOW_MIN; show -= 2) {
      seat.querySelector(".seat-melds").style.setProperty("--meld-step", `${show - MELD_CARD_W}px`);
      const sizes = meldEls.map((meld) => {
        const rect = meld.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const labelUnder = (boxes, avatar) => {
        if (!boxes?.length) return null;
        for (const sized of labelSizes) {
          const under = underStack(boxes, sized.width, sized.height, occupied, avatar);
          if (under) return { infoBox: under, infoSize: sized };
        }
        return null;
      };
      const labelUnderAvatar = (avatar) => {
        for (const sized of labelSizes) {
          const under = underAvatar(avatar, sized.width, sized.height, occupied);
          if (under) return { infoBox: under, infoSize: sized };
        }
        return null;
      };
      let candidate = null;
      let stop = false;
      for (let ta = deckLimit + 16; ta < tableR - 8 && !stop; ta += 6) {
        for (let cross = 0; cross <= 72 && !stop; cross += 12) {
          for (const dir of cross === 0 ? [0] : [1, -1]) {
            const ax = ux * ta - uy * cross * dir;
            const ay = uy * ta + ux * cross * dir;
            const avatar = localBox(ax, ay, avatarSize, avatarSize);
            if (!onTable(avatar) || !clearOf(avatar, occupied)) continue;
            const separated = findStack(avatar, ux, uy, sizes, show, occupied, false);
            const nested = sizes.length ? findStack(avatar, ux, uy, sizes, show, occupied, true) : null;
            let boxes = separated?.boxes ?? nested?.boxes ?? [];
            let stackScore = separated?.score ?? nested?.score ?? 0;
            if (sizes.length && !boxes.length) continue;
            let label = sizes.length ? labelUnder(separated?.boxes, avatar) : labelUnderAvatar(avatar);
            if (sizes.length && !label && nested) {
              const nestedLabel = labelUnder(nested.boxes, avatar);
              if (nestedLabel || !separated) {
                boxes = nested.boxes;
                stackScore = nested.score;
                label = nestedLabel;
              }
            }
            const infoBox = label?.infoBox ?? null;
            const sized = label?.infoSize ?? labelSizes[0];
            const score = stackScore + ta * 0.02 + (infoBox ? 0 : 400);
            if (!candidate || score < candidate.score) {
              candidate = { avatar, boxes, infoSize: sized, infoBox, score };
            }
            if (infoBox && stackScore < 20) stop = true;
          }
        }
      }
      if (candidate?.infoBox) {
        placed = candidate;
        break;
      }
      if (candidate && !placed) placed = candidate;
      if (!meldEls.length) break;
    }
    if (!placed) {
      info.hidden = true;
      continue;
    }

    const infoBox = placed.infoBox;
    applyInfoSize(info, infoBox ? placed.infoSize.px : 0);
    info.hidden = !infoBox;
    if (infoBox) shift(info, infoBox, placed.infoSize.width, placed.infoSize.height);
    shift(avatarEl, placed.avatar, 52, 52);
    placed.boxes.forEach((box, index) => {
      meldEls[index].style.zIndex = String(index + 1);
      shift(meldEls[index], box, box.right - box.left, box.bottom - box.top);
    });
    const cluster = [placed.avatar, ...placed.boxes];
    if (infoBox) cluster.push(infoBox);
    occupied.push(...cluster);
    for (const piece of cluster.slice(1)) occupied.push(corridor(placed.avatar, piece));
    if (infoBox && placed.boxes.length) {
      const lowest = placed.boxes.reduce((a, b) => (a.bottom > b.bottom ? a : b));
      occupied.push(corridor(infoBox, lowest));
    }
  }
}

function renderHand() {
  hand.setCards(visibleHand());
}

function renderActions() {
  const player = me();
  const buttons = [
    { id: "full", label: "Full hand", enabled: myHand().length > 0, run: () => openHand(false) },
    { id: "discard", label: "Discard", enabled: canDiscard(), run: discardSelected },
    { id: "lay", label: "Lay down", enabled: canLay(), run: () => openHand(true) },
    { id: "hit", label: "Hit", enabled: canHit(), run: hitSelected },
    {
      id: "swap",
      label: swapArmed ? "Cancel swap" : "Swap wild",
      enabled: swapArmed || canSwap(),
      run: () => {
        swapArmed = !swapArmed;
        renderActions();
        statusEl.textContent = swapArmed
          ? "Click the meld that will take the Wild"
          : statusLine();
      },
    },
    {
      id: "reveal",
      label: player?.revealed ? "Hide hand" : "Reveal hand",
      enabled: Boolean(player),
      run: () => send({ type: player.revealed ? "hide" : "reveal" }),
    },
    {
      id: "deal",
      label: "Deal",
      enabled: canDeal(),
      run: () => send({ type: "start" }),
    },
    { id: "leave", label: "Leave", enabled: Boolean(state.you), run: leaveTable },
  ];

  fillActions(actionsEl, buttons);
  fillActions(modalActionsEl, buttons.filter((button) => button.id !== "full" && button.id !== "leave"));
}

function fillActions(container, buttons) {
  container.replaceChildren();
  for (const button of buttons) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = button.id === "lay" || button.id === "deal" ? "btn btn-primary" : "btn btn-secondary";
    node.textContent = button.label;
    node.disabled = !button.enabled;
    node.addEventListener("click", button.run);
    container.append(node);
  }
}

function canSwap() {
  const selected = selectedInHand();
  if (!canAct() || !me()?.laidDown || selected.length !== 1 || selected[0].type !== "number" || !meldPick) {
    return false;
  }
  const meld = findMeld(meldPick);
  return Boolean(meld?.cards.some((card) => card.type === "wild" && card.asRank === selected[0].rank));
}

function findMeld(pick) {
  const owner = state.players.find((player) => player.id === pick.ownerId);
  return owner?.melds[pick.meldIndex] ?? null;
}

function discardSelected() {
  const [card] = selectedInHand();
  if (!card) return;
  send({ type: "discard", cardId: card.id });
  hand.clearSelection();
}

function hitSelected() {
  const specs = inferHit(findMeld(meldPick), selectedInHand());
  if (!specs) {
    showError("Those cards don't fit that meld");
    return;
  }
  send({
    type: "hit",
    ownerId: meldPick.ownerId,
    meldIndex: meldPick.meldIndex,
    cards: specs,
  });
  hand.clearSelection();
}

function onMeld(ownerId, meldIndex) {
  if (swapArmed && meldPick) {
    const selected = selectedInHand();
    const source = findMeld(meldPick);
    const wild = source?.cards.find((card) => card.type === "wild" && card.asRank === selected[0]?.rank);
    const destination = state.players.find((player) => player.id === ownerId)?.melds[meldIndex];
    const played = wild && destination ? inferHit(destination, [wild]) : null;
    if (!wild || !played) {
      showError("That Wild can't move there");
      return;
    }
    send({
      type: "replaceWild",
      ownerId: meldPick.ownerId,
      meldIndex: meldPick.meldIndex,
      wildCardId: wild.id,
      naturalCardId: selected[0].id,
      destinationOwnerId: ownerId,
      destinationIndex: meldIndex,
      asRank: played[0].asRank,
      asColor: played[0].asColor,
    });
    swapArmed = false;
    hand.clearSelection();
    return;
  }
  meldPick = { ownerId, meldIndex };
  renderTable();
  renderActions();
}

function renderPhase() {
  const player = me();
  if (!player || player.waiting) {
    phaseLineEl.textContent = "";
    return;
  }
  phaseLineEl.textContent = `Phase ${player.phase}: ${phaseDef(player.phase).label}`;
}

function renderBots() {
  const seated = Boolean(state.you && !state.you.spectator);
  botsEl.hidden = !seated;
  if (!seated) return;
  const count = state.botCount ?? 0;
  botsCountEl.textContent = String(count);
  const allowed = canSetBots();
  botsLessEl.disabled = !allowed || count <= 0;
  botsMoreEl.disabled = !allowed || count >= (state.botLimit ?? 0);
}

function renderTableControls() {
  const seated = seatedHere();
  tableControlsEl.hidden = !seated;
  if (!seated) return;
  const players = state.players.filter((entry) => !entry.left).length;
  endGameEl.disabled = state.status === "lobby";
  newGameEl.disabled = players < 2;
}

function renderResult() {
  resultEl.replaceChildren();
  const result = state.roundResult;
  if (!result) return;
  const heading = document.createElement("h2");
  heading.textContent = state.status === "gameOver"
    ? `${result.winnerName} wins`
    : `${result.wentOutName} went out`;
  const list = document.createElement("ul");
  list.className = "score-list";
  for (const row of result.rows) {
    const item = document.createElement("li");
    const note = row.completed ? "finished" : row.advanced ? "phase cleared" : "stayed";
    item.textContent = `${row.name}: +${row.points} · ${row.total} · ${note}`;
    list.append(item);
  }
  resultEl.append(heading, list);
}

function renderChat() {
  const nearBottom = chatLogEl.scrollHeight - chatLogEl.scrollTop - chatLogEl.clientHeight < 40;
  chatLogEl.replaceChildren();
  for (const message of state.chat) {
    const bubble = document.createElement("div");
    bubble.className = message.playerId === state.you?.id ? "bubble is-self" : "bubble";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = message.playerId === state.you?.id ? "You" : message.name;
    bubble.append(who, document.createTextNode(message.text));
    chatLogEl.append(bubble);
  }
  if (nearBottom) chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function statusLine() {
  if (!state.you) return "Pull up a chair";
  if (state.you.spectator) return "You're watching. A seat opens when someone leaves.";
  if (state.you.waiting) return "You're in. Cards come your way next round.";
  if (state.status === "lobby") {
    if (state.dealerId !== state.you.id) return "Waiting for the dealer to start.";
    const seated = state.players.filter((entry) => !entry.left).length;
    return seated >= 2
      ? "You're dealing. Deal when you're ready."
      : "You're dealing. Add an AI player or wait for another person.";
  }
  if (state.status === "roundEnd") return `${state.roundResult?.wentOutName ?? "Someone"} went out.`;
  if (state.status === "gameOver") return `${state.roundResult?.winnerName ?? "Someone"} finishes phase 10.`;
  if (!myTurn()) {
    const name = state.players.find((player) => player.id === state.turnId)?.name;
    return name ? `${name} to play` : "Waiting on the next player";
  }
  if (state.step === "draw") return "Your turn — draw a card";
  return "Your turn — play, then discard";
}

function openHand(lay) {
  layMode = lay;
  groups = lay ? phaseDef(me().phase).groups.map(() => []) : [];
  handTitle.textContent = lay ? "Lay down your phase" : "Your hand";
  layConfirm.hidden = !lay;
  layTrays.hidden = !lay;
  renderTrays();
  if (!handDialog.open) handDialog.showModal();
  requestAnimationFrame(() => {
    placeHand();
    renderHand();
  });
}

function closeHand() {
  layMode = false;
  groups = [];
  if (handDialog.open) handDialog.close();
  placeHand();
  renderHand();
}

function renderTrays() {
  layTrays.replaceChildren();
  if (!layMode || !me()) return;
  phaseDef(me().phase).groups.forEach((need, index) => {
    const tray = document.createElement("div");
    tray.className = "lay-tray";
    tray.dataset.drop = String(index);
    const title = document.createElement("span");
    title.className = "lay-title";
    title.textContent = groupLabel(need);
    const row = document.createElement("div");
    row.className = "lay-cards";
    for (const card of groups[index]) {
      const face = miniCard(card, 48, 84);
      face.tabIndex = 0;
      face.setAttribute("role", "button");
      face.setAttribute("aria-label", `Remove ${face.title}`);
      face.addEventListener("click", (event) => {
        event.stopPropagation();
        removeFromGroup(card.id);
      });
      row.append(face);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-secondary";
    add.textContent = "Add selected";
    add.addEventListener("click", () => {
      for (const card of hand.getSelected()) addToGroup(card.id, index);
    });
    tray.append(title, row, add);
    layTrays.append(tray);
  });
}

function addToGroup(cardId, index) {
  if (!layMode) return;
  const card = myHand().find((entry) => entry.id === cardId);
  if (!card) return;
  groups = groups.map((group) => group.filter((entry) => entry.id !== cardId));
  groups[index] = [...groups[index], card];
  hand.clearSelection();
  renderHand();
  renderTrays();
}

function removeFromGroup(cardId) {
  groups = groups.map((group) => group.filter((card) => card.id !== cardId));
  renderHand();
  renderTrays();
}

function confirmLay() {
  const player = me();
  const def = phaseDef(player.phase);
  const payload = [];
  for (let index = 0; index < def.groups.length; index += 1) {
    const assigned = assignGroup(def.groups[index].kind, groups[index]);
    if (!assigned || groups[index].length < def.groups[index].count) {
      showError(`Check your ${groupLabel(def.groups[index]).toLowerCase()}`);
      return;
    }
    payload.push(assigned);
  }
  layPending = true;
  send({ type: "layDown", groups: payload });
}

function openStats(playerId) {
  statsPlayerId = playerId;
  if (!statsDialog.open) statsDialog.showModal();
  paintStats();
}

function paintStats() {
  const player = state?.players.find((entry) => entry.id === statsPlayerId);
  statsBody.replaceChildren();
  if (!player) return;
  const image = document.createElement("img");
  image.className = "stats-avatar";
  image.src = avatarUrl(player.name);
  image.alt = "";
  const title = document.createElement("h2");
  title.textContent = player.name;
  const when = document.createElement("p");
  const joined = new Date(player.joinedAt);
  when.textContent = `Joined ${joined.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${elapsed(player.joinedAt)}`;
  const phase = document.createElement("p");
  phase.textContent = `Phase ${player.phase} · ${player.score} points`;
  statsBody.append(image, title, when, phase);
  if (player.hand) {
    const row = document.createElement("div");
    row.className = "stats-hand";
    row.setAttribute("aria-label", `${player.name}'s hand`);
    for (const card of player.hand) row.append(miniCard(card, 64, 112));
    statsBody.append(row);
  } else {
    const hidden = document.createElement("p");
    hidden.textContent = "Hand hidden";
    statsBody.append(hidden);
  }
}

function elapsed(joinedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
}

function leaveTable() {
  send({ type: "leave" });
  sessionStorage.removeItem("playerId");
  sessionStorage.removeItem("playerName");
  closeHand();
  if (statsDialog.open) statsDialog.close();
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}`);
  socket.addEventListener("open", () => {
    const playerId = sessionStorage.getItem("playerId");
    const name = sessionStorage.getItem("playerName");
    if (playerId && name) send({ type: "join", playerId, name });
    else if (!joinDialog.open) joinDialog.showModal();
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "hello") {
      sessionStorage.setItem("playerId", message.playerId);
      if (joinDialog.open) joinDialog.close();
    } else if (message.type === "state") {
      state = message.state;
      if (state.you?.name) sessionStorage.setItem("playerName", state.you.name);
      const live = new Set(myHand().map((card) => card.id));
      groups = groups.map((group) => group.filter((card) => live.has(card.id)));
      if (layPending && me()?.laidDown) {
        layPending = false;
        closeHand();
      }
      render();
    } else if (message.type === "error") {
      layPending = false;
      showError(message.message);
      if (!state?.you && !joinDialog.open) joinDialog.showModal();
    } else if (message.type === "left") {
      state = null;
      youChip.replaceChildren();
      tableControlsEl.hidden = true;
      statusEl.textContent = "You left the table";
      if (!joinDialog.open) joinDialog.showModal();
    }
  });
  socket.addEventListener("close", () => {
    if (sessionStorage.getItem("playerId")) setTimeout(connect, 800);
  });
}

window.addEventListener("resize", () => {
  if (state) placeSeats();
});

botsLessEl.addEventListener("click", () => {
  if (!canSetBots()) return;
  send({ type: "setBots", count: (state.botCount ?? 0) - 1 });
});

botsMoreEl.addEventListener("click", () => {
  if (!canSetBots()) return;
  send({ type: "setBots", count: (state.botCount ?? 0) + 1 });
});

endGameEl.addEventListener("click", () => {
  if (!seatedHere() || state.status === "lobby") return;
  send({ type: "endGame" });
});

newGameEl.addEventListener("click", () => {
  if (!seatedHere()) return;
  send({ type: "newGame" });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  send({ type: "chat", text });
  chatInput.value = "";
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = joinName.value.trim();
  if (!name) return;
  sessionStorage.setItem("playerName", name);
  send({
    type: "join",
    name,
    playerId: sessionStorage.getItem("playerId") || undefined,
  });
});

document.querySelector("#hand-close").addEventListener("click", closeHand);
layConfirm.addEventListener("click", confirmLay);
handDialog.addEventListener("close", () => {
  layMode = false;
  groups = [];
  placeHand();
  renderHand();
});
document.querySelector("#stats-close").addEventListener("click", () => statsDialog.close());

new ResizeObserver(() => placeHand()).observe(handDock);
new ResizeObserver(() => {
  if (handDialog.open) placeHand();
}).observe(handStage);

setInterval(() => {
  if (statsDialog.open) paintStats();
}, 1000);

loadSheet().then(() => connect());
