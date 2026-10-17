#!/usr/bin/env python3
"""Build a 1×13 card sheet from the top row of the monochrome grid.

The original grid is not evenly pitched, so equal-cell crops clip borders and
include the sheet margin. This writes a new PNG whose cells are identical:
each card is centered in the widest border box, and every card shares one
top and bottom. The source file is not modified.
"""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dcv" / "Monochrome Numbered Card Grid.png"
DEST = ROOT / "dcv" / "Monochrome Numbered Card Row.png"

# Solid stroke vs near-white sheet. Fringe expansion uses a lighter cutoff.
STROKE = 200
FRINGE = 248
TOP_SEARCH = (60, 280)


def read_png(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"not a png: {path}")
    pos = 8
    width = height = None
    idat = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, depth, color = struct.unpack(">IIBB", chunk[:10])
            if depth != 8 or color != 2:
                raise SystemExit(f"expected 8-bit RGB, got depth={depth} color={color}")
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(bytes(idat))
    bpp = 3
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    i = 0

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    for _y in range(height):
        filt = raw[i]
        i += 1
        scan = bytearray(raw[i : i + stride])
        i += stride
        if filt == 1:
            for x in range(stride):
                left = scan[x - bpp] if x >= bpp else 0
                scan[x] = (scan[x] + left) & 255
        elif filt == 2:
            for x in range(stride):
                scan[x] = (scan[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                left = scan[x - bpp] if x >= bpp else 0
                scan[x] = (scan[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                a = scan[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                scan[x] = (scan[x] + paeth(a, b, c)) & 255
        elif filt != 0:
            raise SystemExit(f"unsupported png filter {filt}")
        rows.append(scan)
        prev = scan
    return width, height, rows


def min_channel(rows, x, y):
    pixel = rows[y]
    o = x * 3
    return min(pixel[o], pixel[o + 1], pixel[o + 2])


def stroke_boxes(width, rows):
    y0, y1 = TOP_SEARCH
    col_hit = []
    for x in range(width):
        hits = 0
        for y in range(y0, y1):
            if min_channel(rows, x, y) < STROKE:
                hits += 1
                if hits > 4:
                    break
        col_hit.append(hits > 4)

    spans = []
    start = None
    for x, hit in enumerate(col_hit):
        if hit and start is None:
            start = x
        elif not hit and start is not None:
            spans.append((start, x - 1))
            start = None
    if start is not None:
        spans.append((start, width - 1))
    if len(spans) != 13:
        raise SystemExit(f"expected 13 top-row cards, found {len(spans)}: {spans}")

    boxes = []
    for a, b in spans:
        xs = [
            x
            for x in range(max(0, a - 3), min(width, b + 4))
            if any(min_channel(rows, x, y) < STROKE for y in range(y0, y1))
        ]
        ys = [
            y
            for y in range(y0, y1)
            if any(min_channel(rows, x, y) < STROKE for x in range(a, b + 1))
        ]
        boxes.append([min(xs), max(xs), min(ys), max(ys)])
    return boxes


def expand_fringe(width, height, rows, boxes):
    """Grow each box by one pixel of antialiased stroke, without touching the next card."""
    expanded = []
    for i, (x0, x1, y0, y1) in enumerate(boxes):
        left_limit = 0 if i == 0 else (boxes[i - 1][1] + x0) // 2
        right_limit = width - 1 if i == len(boxes) - 1 else (x1 + boxes[i + 1][0]) // 2

        nx0 = x0
        if x0 - 1 >= left_limit and any(
            min_channel(rows, x0 - 1, y) < FRINGE for y in range(y0, y1 + 1)
        ):
            nx0 = x0 - 1
        nx1 = x1
        if x1 + 1 <= right_limit and any(
            min_channel(rows, x1 + 1, y) < FRINGE for y in range(y0, y1 + 1)
        ):
            nx1 = x1 + 1

        ny0 = y0
        if y0 - 1 >= 0 and any(
            min_channel(rows, x, y0 - 1) < FRINGE for x in range(nx0, nx1 + 1)
        ):
            ny0 = y0 - 1
        ny1 = y1
        if y1 + 1 < height and any(
            min_channel(rows, x, y1 + 1) < FRINGE for x in range(nx0, nx1 + 1)
        ):
            ny1 = y1 + 1
        expanded.append([nx0, nx1, ny0, ny1])
    return expanded


def write_png(path, width, height, rgb_rows):
    def chunk(tag, payload):
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    raw = bytearray()
    stride = width * 3
    for row in rgb_rows:
        if len(row) != stride:
            raise SystemExit("row stride mismatch")
        raw.append(0)
        raw.extend(row)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    width, height, rows = read_png(SOURCE)
    boxes = expand_fringe(width, height, rows, stroke_boxes(width, rows))

    top = min(box[2] for box in boxes)
    bottom = max(box[3] for box in boxes)
    cell_h = bottom - top + 1
    cell_w = max(box[1] - box[0] + 1 for box in boxes)
    sheet_w = cell_w * 13

    bg = rows[0][0:3]
    sheet = [bytearray(bg * sheet_w) for _ in range(cell_h)]

    print(f"source {width}x{height}")
    print(f"shared y={top}-{bottom} cell={cell_w}x{cell_h} sheet={sheet_w}x{cell_h}")
    for i, (x0, x1, _y0, _y1) in enumerate(boxes):
        card_w = x1 - x0 + 1
        pad = cell_w - card_w
        left = pad // 2
        dst_x = i * cell_w + left
        for y in range(cell_h):
            src = rows[top + y]
            s = x0 * 3
            d = dst_x * 3
            sheet[y][d : d + card_w * 3] = src[s : s + card_w * 3]
        gap = "-" if i == 0 else x0 - boxes[i - 1][1] - 1
        print(
            f"  {i + 1:2d} src {x0:4d}-{x1:<4d} w={card_w:3d} "
            f"pad={pad} left={left} gap_before={gap}"
        )

    write_png(DEST, sheet_w, cell_h, sheet)
    print(f"wrote {DEST}")


if __name__ == "__main__":
    main()
