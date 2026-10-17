# -*- coding: utf-8 -*-
import os
import re
from collections import Counter

root = r"C:\Users\shadr\Documents\bim_portfolio\public\models\kns\sheets\tx"
for name in ["2.svg", "3.svg", "4.svg", "1.svg"]:
    path = os.path.join(root, name)
    if not os.path.exists(path):
        print(name, "MISSING")
        continue
    data = open(path, encoding="utf-8", errors="replace").read()
    coords = re.findall(r"[ML]\s*([-\d.]+),([-\d.]+)", data)
    xs = [float(a) for a, b in coords]
    ys = [float(b) for a, b in coords]
    ids = set(re.findall(r'data-element-id="([^"]+)"', data))
    print(name, "ids", len(ids), "pts", len(xs), "mtime", os.path.getmtime(path))
    if not xs:
        continue
    print(
        "  x",
        round(min(xs), 1),
        round(max(xs), 1),
        "y",
        round(min(ys), 1),
        round(max(ys), 1),
    )
    inb = sum(1 for x, y in zip(xs, ys) if 0 <= x <= 420 and 0 <= y <= 297)
    pct = 100.0 * inb / len(xs)
    print("  in_viewbox", inb, "/", len(xs), "({:.0f}%)".format(pct))
    bins = Counter(int(x // 20) * 20 for x in xs if 0 <= x <= 420)
    print("  x bins", sorted(bins.items()))
