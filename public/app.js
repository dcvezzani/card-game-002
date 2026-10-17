const handEl = document.getElementById("hand");
const turnCopyEl = document.getElementById("turn-copy");
const playBtn = document.getElementById("play");
const arenaEl = document.querySelector(".arena");

const FAN_LAYOUT = { width: 760, height: 380 };

const hand = await fetch("/api/hand").then((res) => {
  if (!res.ok) throw new Error(`Hand request failed: ${res.status}`);
  return res.json();
});

/** Player-selected ranks. The sticker ring marks this set, not hover. */
const selected = new Set([hand.selectedRank ?? 1]);

function spriteStyle(card, sheetUrl) {
  const { sprite, cardWidth, cardHeight } = card;
  const scaleX = cardWidth / sprite.w;
  const scaleY = cardHeight / sprite.h;
  return {
    "--card-w": `${cardWidth}px`,
    "--card-h": `${cardHeight}px`,
    "--x": `${card.x}px`,
    "--y": `${card.y}px`,
    "--angle": `${card.angleDeg}deg`,
    "--sheet": `url("${sheetUrl}")`,
    "--sheet-w": `${sprite.sheetWidth * scaleX}px`,
    "--sheet-h": `${sprite.sheetHeight * scaleY}px`,
    "--sprite-x": `${-sprite.x * scaleX}px`,
    "--sprite-y": `${-sprite.y * scaleY}px`,
  };
}

function applyVars(el, vars) {
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value);
  }
}

function selectedList() {
  return [...selected].sort((a, b) => a - b);
}

function syncSelection() {
  const ranks = selectedList();
  for (const card of handEl.querySelectorAll(".card")) {
    const isSelected = selected.has(Number(card.dataset.rank));
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  }

  if (ranks.length === 0) {
    turnCopyEl.textContent = "Your turn — pick a card";
  } else if (ranks.length === 1) {
    turnCopyEl.textContent = `Your turn — card ${ranks[0]} selected`;
  } else {
    turnCopyEl.textContent = `Your turn — cards ${ranks.join(", ")} selected`;
  }

  playBtn.disabled = ranks.length === 0;
}

function toggleSelect(rank) {
  if (selected.has(rank)) selected.delete(rank);
  else selected.add(rank);
  syncSelection();
}

function render() {
  handEl.replaceChildren();

  for (const card of hand.cards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.role = "listitem";
    button.dataset.rank = String(card.rank);
    button.setAttribute("aria-label", `Card ${card.rank}`);
    button.style.zIndex = String(card.zIndex);
    applyVars(button, spriteStyle(card, hand.sheetUrl));

    const face = document.createElement("span");
    face.className = "card-face";
    face.setAttribute("aria-hidden", "true");
    button.append(face);

    button.addEventListener("click", () => toggleSelect(card.rank));
    handEl.append(button);
  }

  syncSelection();
  requestAnimationFrame(fitHandToArena);
}

function scaleHandToArena() {
  if (!arenaEl || !handEl) return;
  const rect = arenaEl.getBoundingClientRect();
  const inset = 28;
  const availW = Math.max(0, rect.width - inset);
  const availH = Math.max(0, rect.height - inset);
  const scale = Math.min(
    availW / FAN_LAYOUT.width,
    availH / FAN_LAYOUT.height,
    1,
  );
  handEl.style.setProperty("--hand-scale", String(scale));
}

function alignHandHorizontally() {
  if (!arenaEl || !handEl) return;

  handEl.style.setProperty("--hand-shift-x", "0px");

  const selectedCards = [...handEl.querySelectorAll(".card.selected")];
  for (const card of selectedCards) card.classList.remove("selected");

  const cards = [...handEl.querySelectorAll(".card")];
  if (!cards.length) return;

  void handEl.offsetWidth;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const card of cards) {
    const box = card.getBoundingClientRect();
    minX = Math.min(minX, box.left);
    maxX = Math.max(maxX, box.right);
  }

  const arena = arenaEl.getBoundingClientRect();
  const dx = (arena.left + arena.right) / 2 - (minX + maxX) / 2;
  handEl.style.setProperty("--hand-shift-x", `${dx}px`);

  for (const card of selectedCards) card.classList.add("selected");
}

function fitHandToArena() {
  scaleHandToArena();
  alignHandHorizontally();
}

if (arenaEl) {
  fitHandToArena();
  new ResizeObserver(fitHandToArena).observe(arenaEl);
}

playBtn.addEventListener("click", () => {
  const ranks = selectedList();
  if (!ranks.length) return;
  turnCopyEl.textContent =
    ranks.length === 1
      ? `Played card ${ranks[0]}. Your turn`
      : `Played cards ${ranks.join(", ")}. Your turn`;
  selected.clear();
  syncSelection();
});

render();
