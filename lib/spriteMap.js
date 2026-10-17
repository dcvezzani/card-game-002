/** 15×11 sheet. Row 0 is the monochrome source. Rows 1–10 are the ten colors. */
export const NUMBER_RANKS = 13;
export const COLOR_ROW_OFFSET = 1;
export const SHEET = {
  width: (NUMBER_RANKS + 2) * 116,
  height: 11 * 198,
  cols: NUMBER_RANKS + 2,
  rows: 10 + COLOR_ROW_OFFSET,
};

export const CELL_WIDTH = SHEET.width / SHEET.cols;
export const CELL_HEIGHT = SHEET.height / SHEET.rows;

/** Color ids 0–9 are rows 1–10. Black is the monochrome row. */
export const COLORS = [
  { id: 0, name: "red", hex: "#D92B2B" },
  { id: 1, name: "orange", hex: "#E86A17" },
  { id: 2, name: "gold", hex: "#C8960A" },
  { id: 3, name: "green", hex: "#1F8A3B" },
  { id: 4, name: "teal", hex: "#0E8E86" },
  { id: 5, name: "blue", hex: "#1D6FD4" },
  { id: 6, name: "indigo", hex: "#3D3FBF" },
  { id: 7, name: "purple", hex: "#8A2FBF" },
  { id: 8, name: "magenta", hex: "#D12B7A" },
  { id: 9, name: "brown", hex: "#8A5A2B" },
];

/** Monochrome row. Wild and Skip faces live here. */
export const BLACK = { id: 10, name: "black", hex: "#1A1A1A", row: 0 };

export function colorByName(name) {
  if (name === BLACK.name) return BLACK;
  const found = COLORS.find((entry) => entry.name === name);
  if (!found) throw new RangeError(`unknown color ${name}`);
  return found;
}

/** Sheet row for a color id. Black is row 0; the others follow it. */
export function rowForColor(colorId) {
  if (colorId === BLACK.id) return BLACK.row;
  const found = COLORS.find((entry) => entry.id === colorId);
  if (!found) throw new RangeError(`unknown color ${colorId}`);
  return found.id + COLOR_ROW_OFFSET;
}

export const WILD_FACE = { col: NUMBER_RANKS, row: 0 };
export const SKIP_FACE = { col: NUMBER_RANKS + 1, row: 0 };

/** True once each color row has the appended Wild and Skip cells. */
export function hasLetterFaces() {
  return SHEET.cols >= NUMBER_RANKS + 2;
}

/** Point crops at the real sheet. Width and height come from the PNG. */
export function useSheet(width, height) {
  if (!width || !height) return SHEET;
  SHEET.width = width;
  SHEET.height = height;
  SHEET.cols = Math.max(1, Math.round(width / CELL_WIDTH));
  SHEET.rows = Math.max(1, Math.round(height / CELL_HEIGHT));
  return SHEET;
}

function cropAt(col, row) {
  return {
    x: col * CELL_WIDTH,
    y: row * CELL_HEIGHT,
    w: CELL_WIDTH,
    h: CELL_HEIGHT,
    sheetWidth: SHEET.width,
    sheetHeight: SHEET.height,
  };
}

/**
 * Pixel crop for a rank on a color row.
 * @param {number} rank 1–13
 * @param {number} [row=0] sheet row; row 0 is monochrome, rows 1–10 are colors
 */
export function cropForRank(rank, row = 0) {
  if (rank < 1 || rank > NUMBER_RANKS) {
    throw new RangeError(`rank must be 1–${NUMBER_RANKS}`);
  }
  if (row < 0 || row >= SHEET.rows) {
    throw new RangeError(`row must be 0–${SHEET.rows - 1}`);
  }
  return cropAt(rank - 1, row);
}

export function colorById(color) {
  const found = COLORS.find((entry) => entry.id === color);
  if (!found) throw new RangeError(`unknown color ${color}`);
  return found;
}

/**
 * Crop for a number, wild, or skip card.
 * Before Wild and Skip are appended, those cards use the color-1 and color-2 13s.
 */
export function cropForCard(card) {
  if (card.type === "wild" || card.type === "skip") {
    const row = rowForColor(card.color ?? BLACK.id);
    if (!hasLetterFaces()) {
      return cropForRank(13, card.type === "wild" ? COLOR_ROW_OFFSET : COLOR_ROW_OFFSET + 1);
    }
    const col = card.type === "wild" ? WILD_FACE.col : SKIP_FACE.col;
    return cropAt(col, row);
  }
  return cropForRank(card.rank, rowForColor(card.color));
}

export function cardName(card) {
  if (card.type === "wild") return "Wild";
  if (card.type === "skip") return "Skip";
  return `${colorById(card.color).name} ${card.rank}`;
}
