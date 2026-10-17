#!/usr/bin/env python3
"""Append W and S cards to the monochrome row.

Each new cell matches the numbered cells (116×198): the same double border,
white face, large center letter, and small corner letters. The numbered
art is left as it is. Re-running replaces a previous W/S pair.
"""

import ctypes
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "dcv" / "Monochrome Numbered Card Row.png"
FONT = Path("/mnt/c/Windows/Fonts/ariblk.ttf")

CELL_W = 116
NUMBERED = 13
LETTERS = ("W", "S")
INK = 160
# Center letters stay inside the inner border. W is wider than a digit,
# so it uses the largest size that still clears this margin.
MARGIN = 6


def load_png_tools():
    path = Path(__file__).with_name("build_card_row.py")
    spec = importlib.util.spec_from_file_location("build_card_row", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.read_png, mod.write_png


def min_ch(rows, x, y):
    o = x * 3
    pixel = rows[y]
    return min(pixel[o], pixel[o + 1], pixel[o + 2])


def components(rows, x0, x1, height, thresh=INK):
    seen = set()
    comps = []
    for y in range(height):
        for x in range(x0, x1):
            if (x, y) in seen or min_ch(rows, x, y) >= thresh:
                continue
            comp = []
            stack = [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for ny in range(cy - 1, cy + 2):
                    if ny < 0 or ny >= height:
                        continue
                    for nx in range(cx - 1, cx + 2):
                        if nx < x0 or nx >= x1 or (nx, ny) in seen:
                            continue
                        if min_ch(rows, nx, ny) < thresh:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            comps.append(comp)
    return comps


def bounds(comp):
    xs = [p[0] for p in comp]
    ys = [p[1] for p in comp]
    return min(xs), min(ys), max(xs), max(ys)


def blank_face(rows, height):
    """Card 1's frame with the numerals painted back to the sheet white."""
    comps = components(rows, 0, CELL_W, height)
    rings = []
    glyphs = []
    for comp in comps:
        _x0, y0, _x1, y1 = bounds(comp)
        if y1 - y0 > height * 0.8:
            rings.append(set(comp))
        else:
            glyphs.append(comp)
    if len(rings) != 2:
        raise SystemExit(f"expected 2 border rings on the template, found {len(rings)}")
    border = rings[0] | rings[1]
    bg = bytes(rows[0][0:3])
    card = [bytearray(rows[y][0 : CELL_W * 3]) for y in range(height)]
    for comp in glyphs:
        erase = set(comp)
        for x, y in comp:
            for ny in range(y - 2, y + 3):
                if ny < 0 or ny >= height:
                    continue
                for nx in range(x - 2, x + 3):
                    if 0 <= nx < CELL_W and (nx, ny) not in border:
                        erase.add((nx, ny))
        for x, y in erase:
            card[y][x * 3 : x * 3 + 3] = bg
    return card, glyphs


def content_box(rows, height):
    """Interior of the inner border on the template card."""
    comps = components(rows, 0, CELL_W, height)
    rings = [c for c in comps if bounds(c)[3] - bounds(c)[1] > height * 0.8]
    rings.sort(key=lambda comp: bounds(comp)[0])
    inner = rings[1]
    left, top, right, bottom = bounds(inner)
    mid_x = (left + right) / 2
    mid_y = (top + bottom) / 2
    left_edge = max(x for x, y in inner if x < mid_x and abs(y - mid_y) < 15)
    right_edge = min(x for x, y in inner if x > mid_x and abs(y - mid_y) < 15)
    top_edge = max(y for x, y in inner if y < mid_y and abs(x - mid_x) < 15)
    bottom_edge = min(y for x, y in inner if y > mid_y and abs(x - mid_x) < 15)
    return left_edge + 1, top_edge + 1, right_edge - 1, bottom_edge - 1


class Face:
    def __init__(self, path):
        self.ft = ctypes.CDLL("libfreetype.so.6")
        self.ft.FT_Init_FreeType.argtypes = [ctypes.POINTER(ctypes.c_void_p)]
        self.ft.FT_Init_FreeType.restype = ctypes.c_int
        self.ft.FT_New_Face.argtypes = [
            ctypes.c_void_p,
            ctypes.c_char_p,
            ctypes.c_long,
            ctypes.POINTER(ctypes.c_void_p),
        ]
        self.ft.FT_New_Face.restype = ctypes.c_int
        self.ft.FT_Set_Pixel_Sizes.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint]
        self.ft.FT_Set_Pixel_Sizes.restype = ctypes.c_int
        self.ft.FT_Load_Char.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int]
        self.ft.FT_Load_Char.restype = ctypes.c_int
        lib = ctypes.c_void_p()
        if self.ft.FT_Init_FreeType(ctypes.byref(lib)):
            raise SystemExit("FreeType init failed")
        self.face = ctypes.c_void_p()
        if self.ft.FT_New_Face(lib, str(path).encode(), 0, ctypes.byref(self.face)):
            raise SystemExit(f"could not open {path}")

    def render(self, char, px):
        if self.ft.FT_Set_Pixel_Sizes(self.face, 0, px):
            raise SystemExit(f"could not size {char} at {px}px")
        if self.ft.FT_Load_Char(self.face, ord(char), 4):
            raise SystemExit(f"could not render {char}")
        glyph = ctypes.c_void_p.from_address(self.face.value + 152).value
        rows = ctypes.c_uint.from_address(glyph + 152).value
        width = ctypes.c_uint.from_address(glyph + 156).value
        pitch = ctypes.c_int.from_address(glyph + 160).value
        buffer = ctypes.c_void_p.from_address(glyph + 168).value
        raw = ctypes.string_at(buffer, rows * pitch)
        cov = bytearray(rows * width)
        for y in range(rows):
            cov[y * width : (y + 1) * width] = raw[y * pitch : y * pitch + width]
        xs = []
        ys = []
        for y in range(rows):
            row = cov[y * width : (y + 1) * width]
            for x, value in enumerate(row):
                if value > 16:
                    xs.append(x)
                    ys.append(y)
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        cropped_w = x1 - x0 + 1
        cropped_h = y1 - y0 + 1
        cropped = bytearray(cropped_w * cropped_h)
        for y in range(cropped_h):
            src = (y0 + y) * width + x0
            cropped[y * cropped_w : (y + 1) * cropped_w] = cov[src : src + cropped_w]
        return cropped_w, cropped_h, cropped

    def fit(self, char, target_h, max_w):
        chosen = None
        for px in range(8, 180):
            width, height, cov = self.render(char, px)
            if width > max_w or height > target_h:
                break
            chosen = (width, height, cov, px)
        if chosen is None:
            raise SystemExit(f"{char} does not fit {max_w}×{target_h}")
        return chosen


def rot180(width, height, cov):
    turned = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            turned[(height - 1 - y) * width + (width - 1 - x)] = cov[y * width + x]
    return turned


def stamp(card, cov, width, height, dest_x, dest_y):
    card_h = len(card)
    card_w = len(card[0]) // 3
    for y in range(height):
        py = dest_y + y
        if py < 0 or py >= card_h:
            continue
        row = card[py]
        for x in range(width):
            px = dest_x + x
            if px < 0 or px >= card_w:
                continue
            cover = cov[y * width + x]
            if cover == 0:
                continue
            keep = 255 - cover
            o = px * 3
            for channel in range(3):
                row[o + channel] = (row[o + channel] * keep) // 255


def numeral_targets(rows, height):
    """Ink box of the large 8, and the corner 8, in their own cells."""
    center = corner = None
    for index, label in enumerate(range(1, NUMBERED + 1)):
        if label != 8:
            continue
        x0 = index * CELL_W
        for comp in components(rows, x0, x0 + CELL_W, height):
            bx0, by0, bx1, by1 = bounds(comp)
            bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
            if bh > height * 0.8:
                continue
            local = (bx0 - x0, by0, bw, bh)
            if by0 < height / 2 and bh > 40:
                center = local
            elif by0 < height / 2 and corner is None:
                corner = local
    if center is None or corner is None:
        raise SystemExit("could not measure the 8")
    return center, corner


def bottom_anchor(glyphs):
    """Right and bottom edges of the template card's rotated corner index."""
    lower = [comp for comp in glyphs if bounds(comp)[1] > 140]
    if len(lower) != 1:
        raise SystemExit(f"expected one bottom index, found {len(lower)}")
    x0, _y0, x1, y1 = bounds(lower[0])
    return x1, y1


def paint_letter(template, face, letter, center_box, corner_box, opening, bottom):
    card = [bytearray(row) for row in template]
    open_l, _open_t, open_r, _open_b = opening
    max_w = open_r - open_l + 1 - 2 * MARGIN
    _cx, cy, _cw, ch = center_box
    width, height, cov, px = face.fit(letter, ch, max_w)
    dest_x = open_l + MARGIN + (max_w - width) // 2
    dest_y = cy + (ch - height) // 2
    stamp(card, cov, width, height, dest_x, dest_y)

    corner_x, corner_y, _corner_w, corner_h = corner_box
    small_w, small_h, small, _small_px = face.fit(letter, corner_h, max_w)
    stamp(card, small, small_w, small_h, corner_x, corner_y)

    right, bottom_y = bottom
    stamp(
        card,
        rot180(small_w, small_h, small),
        small_w,
        small_h,
        right - small_w + 1,
        bottom_y - small_h + 1,
    )
    return card, {"center": (width, height, px), "corner": (small_w, small_h)}


def main():
    if not FONT.exists():
        raise SystemExit(f"missing font {FONT}")
    read_png, write_png = load_png_tools()
    width, height, rows = read_png(SHEET)
    if width % CELL_W != 0:
        raise SystemExit(f"sheet width {width} is not a multiple of {CELL_W}")
    cols = width // CELL_W
    if cols < NUMBERED:
        raise SystemExit(f"expected at least {NUMBERED} cells, found {cols}")
    if cols > NUMBERED:
        rows = [row[: NUMBERED * CELL_W * 3] for row in rows]
        width = NUMBERED * CELL_W

    center_box, corner_box = numeral_targets(rows, height)
    template, glyphs = blank_face(rows, height)
    opening = content_box(rows, height)
    top_index = [comp for comp in glyphs if bounds(comp)[1] < 80 and bounds(comp)[3] < 50]
    if len(top_index) != 1:
        raise SystemExit(f"expected one top index, found {len(top_index)}")
    top_left = bounds(top_index[0])[0]
    corner = (top_left, corner_box[1], corner_box[2], corner_box[3])
    anchor = bottom_anchor(glyphs)
    face = Face(FONT)

    extra = []
    for letter in LETTERS:
        card, info = paint_letter(template, face, letter, center_box, corner, opening, anchor)
        extra.append(card)
        print(f"{letter} center {info['center'][0]}×{info['center'][1]} at {info['center'][2]}px, corner {info['corner'][0]}×{info['corner'][1]}")

    sheet_w = width + CELL_W * len(LETTERS)
    sheet = []
    for y in range(height):
        row = bytearray(rows[y][: width * 3])
        for card in extra:
            row.extend(card[y])
        sheet.append(row)
    write_png(SHEET, sheet_w, height, sheet)
    print(f"wrote {SHEET} {sheet_w}x{height}")


if __name__ == "__main__":
    main()
