#!/usr/bin/env python3
"""Stack 10 recolored copies of the monochrome card row into one sheet.

Borders and the small corner numerals stay black. The band between the two
borders is filled. The large center numeral keeps a black rim and takes the
same fill. The source row is not modified.
"""

import importlib.util
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dcv" / "Monochrome Numbered Card Row.png"
DEST = ROOT / "dcv" / "Color Numbered Card Sheet.png"

# First color is "color 1" (Wild placeholder). Second is "color 2" (Skip).
COLORS = [
    (217, 43, 43),    # red
    (232, 106, 23),   # orange
    (200, 150, 10),   # gold
    (31, 138, 59),    # green
    (14, 142, 134),   # teal
    (29, 111, 212),   # blue
    (61, 63, 191),    # indigo
    (138, 47, 191),   # purple
    (209, 43, 122),   # magenta
    (138, 90, 43),    # brown
]

# Dark enough to join each border into one ring, light enough to leave the white gap.
INK = 185
OUTLINE = 2


def load_png_tools():
    path = Path(__file__).with_name("build_card_row.py")
    spec = importlib.util.spec_from_file_location("build_card_row", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.read_png, mod.write_png


def pix(rows, x, y):
    o = x * 3
    row = rows[y]
    return row[o], row[o + 1], row[o + 2]


def put(rows, x, y, rgb):
    o = x * 3
    rows[y][o : o + 3] = bytes(rgb)


def min_ch(rgb):
    return rgb[0] if rgb[0] <= rgb[1] and rgb[0] <= rgb[2] else (rgb[1] if rgb[1] <= rgb[2] else rgb[2])


def ink_components(rows, x0, y0, x1, y1):
    """8-connected components of dark pixels. Returns list of sets of (x, y)."""
    seen = set()
    comps = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in seen or min_ch(pix(rows, x, y)) >= INK:
                continue
            comp = set()
            stack = [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.add((cx, cy))
                for ny in range(cy - 1, cy + 2):
                    if ny < y0 or ny >= y1:
                        continue
                    for nx in range(cx - 1, cx + 2):
                        if nx < x0 or nx >= x1 or (nx, ny) in seen:
                            continue
                        if min_ch(pix(rows, nx, ny)) < INK:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            comps.append(comp)
    return comps


def bounds(comp):
    xs = [p[0] for p in comp]
    ys = [p[1] for p in comp]
    return min(xs), min(ys), max(xs), max(ys)


def flood(rows, seeds, x0, y0, x1, y1, blocked):
    seen = set()
    q = deque()
    for seed in seeds:
        if seed in seen or seed in blocked:
            continue
        if min_ch(pix(rows, seed[0], seed[1])) < INK:
            continue
        seen.add(seed)
        q.append(seed)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < x0 or ny < y0 or nx >= x1 or ny >= y1:
                continue
            if (nx, ny) in seen or (nx, ny) in blocked:
                continue
            if min_ch(pix(rows, nx, ny)) < INK:
                continue
            seen.add((nx, ny))
            q.append((nx, ny))
    return seen


def band_seed(rows, outer, inner):
    """A light pixel that sits in the gap just inside the outer stroke."""
    left, top, right, bottom = bounds(outer)
    mid_y = (top + bottom) // 2
    x = left
    while x <= right and (x, mid_y) not in outer:
        x += 1
    while x <= right and (x, mid_y) in outer:
        x += 1
    if x <= right and (x, mid_y) not in inner and min_ch(pix(rows, x, mid_y)) >= INK:
        return (x, mid_y)
    raise SystemExit("could not find the band between borders")


def center_glyphs(comps, borders, card_box):
    left, top, right, bottom = card_box
    width = right - left + 1
    height = bottom - top + 1
    glyphs = []
    for comp in comps:
        if comp in borders:
            continue
        minx, miny, maxx, maxy = bounds(comp)
        cx = (minx + maxx) / 2
        cy = (miny + maxy) / 2
        rx = (cx - left) / width
        ry = (cy - top) / height
        if 0.22 < rx < 0.78 and 0.18 < ry < 0.82:
            glyphs.append(comp)
    return glyphs


def numeral_interior(glyph, rows):
    """Pixels of the glyph farther than OUTLINE steps from an outside pixel."""
    minx, miny, maxx, maxy = bounds(glyph)
    mask = set(glyph)
    q = deque()
    dist = {}
    for y in range(miny - 1, maxy + 2):
        for x in range(minx - 1, maxx + 2):
            if (x, y) not in mask:
                dist[(x, y)] = 0
                q.append((x, y))
    interior = set()
    while q:
        x, y = q.popleft()
        d = dist[(x, y)]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in mask or (nx, ny) in dist:
                continue
            dist[(nx, ny)] = d + 1
            q.append((nx, ny))
            if d + 1 > OUTLINE:
                interior.add((nx, ny))
    return interior


def border_rings(comps, cell_w, height):
    rings = []
    for comp in comps:
        minx, miny, maxx, maxy = bounds(comp)
        if maxy - miny > height * 0.8 and maxx - minx > cell_w * 0.7:
            rings.append(comp)
    if len(rings) != 2:
        raise SystemExit(f"expected 2 border rings, found {len(rings)}")
    rings.sort(key=lambda comp: bounds(comp)[0])
    return rings[0], rings[1]


def masks_for_cell(rows, x0, x1, height, label):
    """Border band and center-letter interior for one card cell."""
    cell_w = x1 - x0
    comps = ink_components(rows, x0, 0, x1, height)
    outer, inner = border_rings(comps, cell_w, height)
    seed = band_seed(rows, outer, inner)
    blocked = outer | inner
    region = flood(rows, [seed], x0, 0, x1, height, blocked)
    if not 2500 <= len(region) <= 5000:
        raise SystemExit(f"{label}: border band is {len(region)} px, expected the gap only")
    fringe = set()
    for x, y in region:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < x0 or ny < 0 or nx >= x1 or ny >= height:
                continue
            if (nx, ny) in region or (nx, ny) in blocked:
                continue
            tone = min_ch(pix(rows, nx, ny))
            if INK <= tone < 250:
                fringe.add((nx, ny))
    glyphs = center_glyphs(comps, (outer, inner), bounds(outer))
    if not glyphs:
        raise SystemExit(f"{label}: no center letter")
    interior = set()
    for glyph in glyphs:
        interior |= numeral_interior(glyph, rows)
    if len(interior) < 400:
        raise SystemExit(f"{label}: center letter interior is only {len(interior)} px")
    print(f"  {label} band={len(region):4d} glyphs={len(glyphs)} interior={len(interior)}")
    return region, fringe, interior


def masks_for_sheet(rows, width, height):
    cell_w = width // 13
    if cell_w * 13 != width:
        raise SystemExit(f"sheet width {width} is not divisible by 13")
    band, band_fringe, interior = set(), set(), set()
    for i in range(13):
        region, fringe, colored = masks_for_cell(rows, i * cell_w, (i + 1) * cell_w, height, f"card {i + 1:2d}")
        band |= region
        band_fringe |= fringe
        interior |= colored
    return band, band_fringe, interior


def masks_for_letters(rows, x0, x1, height):
    cell_w = (x1 - x0) // 2
    if cell_w * 2 != x1 - x0:
        raise SystemExit("letter span is not two equal cells")
    band, band_fringe, interior = set(), set(), set()
    for index, label in enumerate(("W", "S")):
        region, fringe, colored = masks_for_cell(
            rows, x0 + index * cell_w, x0 + (index + 1) * cell_w, height, label
        )
        band |= region
        band_fringe |= fringe
        interior |= colored
    return band, band_fringe, interior


def blend(rgb, color):
    tone = min_ch(rgb) / 255
    return tuple(int(channel * tone) for channel in color)


def recolor(rows, band, band_fringe, interior, color):
    out = [bytearray(row) for row in rows]
    for x, y in band:
        put(out, x, y, color)
    for x, y in interior:
        put(out, x, y, color)
    for x, y in band_fringe:
        put(out, x, y, blend(pix(rows, x, y), color))
    return out


NUMBERED_COLS = 13
CELL_W = 116


def main():
    read_png, write_png = load_png_tools()
    source_w, height, source_rows = read_png(SOURCE)
    numbered_w = NUMBERED_COLS * CELL_W
    if source_w < numbered_w or source_w % CELL_W != 0:
        raise SystemExit(f"source width {source_w} is not a row of {CELL_W}px cells")
    rows = [row[: numbered_w * 3] for row in source_rows]
    letters = [row[numbered_w * 3 :] for row in source_rows]
    print(f"source {numbered_w}x{height}, letter cells {source_w - numbered_w}px")
    band, band_fringe, interior = masks_for_sheet(rows, numbered_w, height)
    if letters[0]:
        letter_band, letter_fringe, letter_interior = masks_for_letters(
            source_rows, numbered_w, source_w, height
        )
    sheet = []
    for index, color in enumerate(COLORS):
        colored = recolor(rows, band, band_fringe, interior, color)
        if letters[0]:
            for y, row in enumerate(colored):
                row.extend(letters[y])
            colored = recolor(colored, letter_band, letter_fringe, letter_interior, color)
        sheet.extend(colored)
        print(f"row {index + 1} {color}")
    sheet = [bytearray(row) for row in source_rows] + sheet
    total_h = height * (len(COLORS) + 1)
    write_png(DEST, source_w, total_h, sheet)
    print(f"wrote {DEST} {source_w}x{total_h}")


if __name__ == "__main__":
    main()
