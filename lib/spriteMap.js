/** 1×13 top-row sheet: 1508×198. Each cell is one full card. */
export const SHEET = {
  width: 1508,
  height: 198,
  cols: 13,
  rows: 1,
};

export const CELL_WIDTH = SHEET.width / SHEET.cols;
export const CELL_HEIGHT = SHEET.height / SHEET.rows;

/**
 * Pixel crop for a rank. The sheet is one row of equal cells, so the crop
 * is the whole cell. `row` is accepted for callers and must be 0.
 * @param {number} rank 1–13
 * @param {number} [row=0]
 */
export function cropForRank(rank, row = 0) {
  if (rank < 1 || rank > SHEET.cols) {
    throw new RangeError(`rank must be 1–${SHEET.cols}`);
  }
  if (row < 0 || row >= SHEET.rows) {
    throw new RangeError(`row must be 0–${SHEET.rows - 1}`);
  }

  const col = rank - 1;
  return {
    x: col * CELL_WIDTH,
    y: 0,
    w: CELL_WIDTH,
    h: CELL_HEIGHT,
    sheetWidth: SHEET.width,
    sheetHeight: SHEET.height,
  };
}
