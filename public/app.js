const handEl = document.getElementById("hand");

const hand = await fetch("/api/hand").then((res) => {
  if (!res.ok) throw new Error(`Hand request failed: ${res.status}`);
  return res.json();
});

let selectedRank = hand.selectedRank ?? hand.cards[0]?.rank ?? 1;

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

function render() {
  handEl.replaceChildren();

  for (const card of hand.cards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.role = "listitem";
    button.dataset.rank = String(card.rank);
    button.setAttribute("aria-label", `Card ${card.rank}`);
    button.setAttribute("aria-pressed", String(card.rank === selectedRank));
    button.style.zIndex = String(card.zIndex);
    applyVars(button, spriteStyle(card, hand.sheetUrl));
    if (card.rank === selectedRank) button.classList.add("selected");

    const face = document.createElement("span");
    face.className = "card-face";
    face.setAttribute("aria-hidden", "true");
    button.append(face);

    button.addEventListener("mouseenter", () => select(card.rank));
    button.addEventListener("focus", () => select(card.rank));
    button.addEventListener("click", () => select(card.rank));

    handEl.append(button);
  }
}

function select(rank) {
  if (rank === selectedRank) return;
  selectedRank = rank;
  for (const card of handEl.querySelectorAll(".card")) {
    const isSelected = Number(card.dataset.rank) === selectedRank;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  }
}

render();
