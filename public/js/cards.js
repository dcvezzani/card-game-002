import { cardName, cropForCard, hasLetterFaces, useSheet } from "/lib/spriteMap.js";

export function loadSheet() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      useSheet(image.naturalWidth, image.naturalHeight);
      resolve();
    };
    image.onerror = () => reject(new Error("Card sheet failed to load"));
    image.src = "/assets/cards.png";
  });
}

export function applyVars(element, vars) {
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

export function faceVars(card, width, height) {
  const sprite = cropForCard(card);
  const scaleX = width / sprite.w;
  const scaleY = height / sprite.h;
  return {
    "--card-w": `${width}px`,
    "--card-h": `${height}px`,
    "--sheet": 'url("/assets/cards.png")',
    "--sheet-w": `${sprite.sheetWidth * scaleX}px`,
    "--sheet-h": `${sprite.sheetHeight * scaleY}px`,
    "--sprite-x": `${-sprite.x * scaleX}px`,
    "--sprite-y": `${-sprite.y * scaleY}px`,
  };
}

export function badgeFor(card) {
  if (hasLetterFaces()) return "";
  if (card.type === "wild") return "W";
  if (card.type === "skip") return "S";
  return "";
}

export function label(card) {
  const name = cardName(card);
  if (card.type !== "wild") return name;
  const parts = [name];
  if (card.asRank) parts.push(`as ${card.asRank}`);
  return parts.join(" ");
}

export function miniCard(card, width = 42, height = 74) {
  const wrap = document.createElement("span");
  wrap.className = "mini-card";
  wrap.title = label(card);
  const face = document.createElement("span");
  face.className = "card-face";
  applyVars(face, faceVars(card, width, height));
  const badge = badgeFor(card);
  if (badge) {
    const mark = document.createElement("span");
    mark.className = "card-badge";
    mark.textContent = badge;
    face.append(mark);
  }
  wrap.append(face);
  return wrap;
}

export function avatarUrl(name) {
  const letter = [...(name || "?")][0].toUpperCase();
  const safe = letter.replace(/[&<>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" fill="#3BADE8" stroke="#2B2A28" stroke-width="4"/><text x="40" y="52" text-anchor="middle" font-family="Nunito, sans-serif" font-size="36" font-weight="800" fill="#ffffff">${safe || "?"}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
