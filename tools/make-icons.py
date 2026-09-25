#!/usr/bin/env python3
"""Generate the add-on icons.

Pure standard library on purpose: the repository has no build dependencies and
the icons stay reproducible (run `python tools/make-icons.py` after changing the
parameters below).

The mark is a paperclip drawn as a stroked path (one continuous wire: right side
down, bottom bend, left side up, top bend, short inner arm) on a rounded blue
tile. Everything is rendered from signed distances and supersampled 4x for
anti-aliasing. Distances are scaled to pixels before the coverage is computed,
otherwise the shape stays half transparent.

This is a placeholder mark - replace the artwork before publishing to
addons.thunderbird.net. See README.md.
"""

import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = (16, 48, 128)
SUPERSAMPLE = 4

TILE = (31, 111, 235)
MARK = (255, 255, 255)
MARGIN = 0.02
TILE_RADIUS = 0.24

# Paperclip geometry, in a 0..1 unit square with y pointing down.
OUTER_RIGHT_X = 0.630
LEFT_X = 0.370
INNER_RIGHT_X = 0.500
TOP_Y = 0.320
BOTTOM_Y = 0.640
FREE_END_TOP_Y = 0.260
FREE_END_INNER_Y = 0.560
BEND_RADIUS = 0.130
TOP_BEND_RADIUS = 0.065

STROKE_HALF_WIDTH = 0.034
STROKE_HALF_WIDTH_SMALL = 0.055


def sd_round_rect(px, py, cx, cy, half_w, half_h, radius):
    qx = abs(px - cx) - (half_w - radius)
    qy = abs(py - cy) - (half_h - radius)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - radius


def coverage(distance_in_pixels):
    return min(max(0.5 - distance_in_pixels, 0.0), 1.0)


def arc_points(cx, cy, radius, start_deg, end_deg, steps=48):
    points = []
    for index in range(steps + 1):
        angle = math.radians(start_deg + (end_deg - start_deg) * index / steps)
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def paperclip_points(simplified=False):
    """One continuous wire, from the free end at the top right to the inner end.

    `simplified` drops the top bend and the inner arm: at 16px the full spiral
    blurs into mush, a bold open loop survives.
    """
    points = [(OUTER_RIGHT_X, FREE_END_TOP_Y), (OUTER_RIGHT_X, BOTTOM_Y)]
    # Bottom bend, sweeping to the left side.
    points += arc_points(
        (OUTER_RIGHT_X + LEFT_X) / 2.0, BOTTOM_Y, BEND_RADIUS, 0, 180
    )
    points.append((LEFT_X, TOP_Y))
    if simplified:
        return points
    # Top bend, sweeping back to the right, into the short inner arm.
    points += arc_points(
        LEFT_X + TOP_BEND_RADIUS, TOP_Y, TOP_BEND_RADIUS, 180, 360
    )
    points.append((INNER_RIGHT_X, FREE_END_INNER_Y))
    return points


def distance_to_path(px, py, points):
    best = float("inf")
    for index in range(len(points) - 1):
        ax, ay = points[index]
        bx, by = points[index + 1]
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        if length_sq == 0.0:
            t = 0.0
        else:
            t = ((px - ax) * dx + (py - ay) * dy) / length_sq
            t = min(max(t, 0.0), 1.0)
        best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best


def render(size):
    points = paperclip_points(simplified=size <= 16)
    half_width = STROKE_HALF_WIDTH_SMALL if size <= 16 else STROKE_HALF_WIDTH
    n = size * SUPERSAMPLE
    rows = []
    for py in range(n):
        row = bytearray()
        for px in range(n):
            x = (px + 0.5) / n
            y = (py + 0.5) / n
            tile = sd_round_rect(
                x, y, 0.5, 0.5, 0.5 - MARGIN, 0.5 - MARGIN, TILE_RADIUS
            )
            alpha = coverage(tile * n)
            if alpha <= 0.0:
                row.extend(TILE)
                row.append(0)
                continue
            wire = (distance_to_path(x, y, points) - half_width) * n
            mark = coverage(wire)
            if mark > 0.0:
                color = tuple(
                    round(TILE[i] + (MARK[i] - TILE[i]) * mark) for i in range(3)
                )
            else:
                color = TILE
            row.extend(color)
            row.append(round(alpha * 255))
        rows.append(bytes(row))

    # Box-downsample the supersampled image.
    out = []
    for oy in range(size):
        row = bytearray()
        for ox in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SUPERSAMPLE):
                src = rows[oy * SUPERSAMPLE + sy]
                for sx in range(SUPERSAMPLE):
                    base = (ox * SUPERSAMPLE + sx) * 4
                    for channel in range(4):
                        acc[channel] += src[base + channel]
            count = SUPERSAMPLE * SUPERSAMPLE
            row.extend(round(value / count) for value in acc)
        out.append(bytes(row))
    return out


def write_png(path, width, height, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        body = tag + data
        return (
            struct.pack(">I", len(data))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def main():
    target = os.path.join(ROOT, "icons")
    os.makedirs(target, exist_ok=True)
    for size in SIZES:
        path = os.path.join(target, "icon-%d.png" % size)
        write_png(path, size, size, render(size))
        print("wrote %s (%d bytes)" % (path, os.path.getsize(path)))


if __name__ == "__main__":
    main()
