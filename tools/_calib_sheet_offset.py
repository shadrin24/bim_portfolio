# -*- coding: utf-8 -*-
"""Find best (dx, dy) to align SVG hit paths with PNG dark ink."""
from __future__ import print_function

import os
import re
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageChops, ImageStat

ROOT = r"C:\Users\shadr\Documents\bim_portfolio\public\models\kns\sheets\tx"
SHEET = "2"


def parse_paths(svg_path):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb = root.get("viewBox", "0 0 420 297").split()
    vw, vh = float(vb[2]), float(vb[3])
    ns = {"s": "http://www.w3.org/2000/svg"}
    segs = []
    for p in root.findall(".//s:path", ns):
        d = p.get("d") or ""
        if p.get("stroke-opacity") == "0":
            continue
        coords = [
            (float(a), float(b))
            for a, b in re.findall(r"[ML]\s*([-\d.]+),([-\d.]+)", d)
        ]
        for i in range(len(coords) - 1):
            x0, y0 = coords[i]
            x1, y1 = coords[i + 1]
            if abs(x1 - x0) + abs(y1 - y0) < 40:
                segs.append((x0, y0, x1, y1))
    return segs, vw, vh


def rasterize(segs, vw, vh, W, H, dx=0.0, dy=0.0):
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)
    sx, sy = W / vw, H / vh
    for x0, y0, x1, y1 in segs:
        draw.line(
            (
                (x0 + dx) * sx,
                (y0 + dy) * sy,
                (x1 + dx) * sx,
                (y1 + dy) * sy,
            ),
            fill=255,
            width=2,
        )
    return img


def score_align(hit, ink_mask):
    # fraction of hit pixels that land on ink
    both = ImageChops.multiply(hit, ink_mask)
    hit_sum = ImageStat.Stat(hit).sum[0]
    both_sum = ImageStat.Stat(both).sum[0]
    if hit_sum < 1:
        return 0.0
    return both_sum / hit_sum


def main():
    png = Image.open(os.path.join(ROOT, SHEET + ".png")).convert("L")
    W, H = png.size
    # dark ink = white in mask
    ink_mask = png.point(lambda p: 255 if p < 180 else 0)
    segs, vw, vh = parse_paths(os.path.join(ROOT, SHEET + ".svg"))
    print("png", W, H, "segs", len(segs), "vb", vw, vh)

    best = (0.0, 0, 0)
    for dy in range(-30, 16, 2):
        for dx in range(-40, 12, 2):
            hit = rasterize(segs, vw, vh, W, H, dx=dx, dy=dy)
            sc = score_align(hit, ink_mask)
            if sc > best[0]:
                best = (sc, dx, dy)
                print("  candidate", best)
    print("coarse best score={:.4f} dx={} dy={}".format(*best))

    _, bx, by = best
    best2 = best
    for dy in range(by - 3, by + 4):
        for dx in range(bx - 3, bx + 4):
            hit = rasterize(segs, vw, vh, W, H, dx=dx, dy=dy)
            sc = score_align(hit, ink_mask)
            if sc > best2[0]:
                best2 = (sc, dx, dy)
    print("refined score={:.4f} dx={} dy={}".format(*best2))

    score, dx, dy = best2
    hit = rasterize(segs, vw, vh, W, H, dx=dx, dy=dy)
    rgb = png.convert("RGB")
    cyan = Image.new("RGB", (W, H), (0, 220, 255))
    # where hit, use cyan
    out = Image.composite(cyan, rgb, hit)
    out_path = os.path.join(ROOT, "_calib_preview.png")
    out.save(out_path)
    print("wrote", out_path)


if __name__ == "__main__":
    main()
