/** 4×13 monochrome numbered sheet: 1536×1024. */
export const SHEET = {
  width: 1536,
  height: 1024,
  cols: 13,
  rows: 4,
};

export const CELL_WIDTH = SHEET.width / SHEET.cols;
export const CELL_HEIGHT = SHEET.height / SHEET.rows;

/** Crop inside each cell so overlapping fans omit sheet gutters. */
const CROP_INSET_X = 7;
const CROP_Y = 70;
const CROP_HEIGHT = 186;

/**
 * Pixel crop for a rank in a given sheet row (0 = first row).
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
    x: col * CELL_WIDTH + CROP_INSET_X,
    y: row * CELL_HEIGHT + CROP_Y,
    w: CELL_WIDTH - CROP_INSET_X * 2,
    h: CROP_HEIGHT,
    sheetWidth: SHEET.width,
    sheetHeight: SHEET.height,
  };
}
