# -*- coding: utf-8 -*-
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

root = r"C:\Users\shadr\Documents\bim_portfolio\public\models\kns\sheets\tx"
files = sorted(os.listdir(root))
pngs = [f for f in files if f.endswith(".png")]
svgs = [f for f in files if f.endswith(".svg")]
print("PNG:", pngs)
print("SVG:", svgs)
print("PNG without SVG:", [p for p in pngs if p[:-4] + ".svg" not in svgs])
print("SVG without PNG:", [s for s in svgs if s[:-4] + ".png" not in pngs])
print()

for name in svgs:
    path = os.path.join(root, name)
    with open(path, encoding="utf-8", errors="replace") as f:
        data = f.read()
    vb = re.search(r'viewBox="([^"]+)"', data)
    n_id = len(set(re.findall(r'data-element-id="([^"]+)"', data)))
    n_path = data.count("<path")
    print(
        f"{name}: size={os.path.getsize(path)} viewBox={vb.group(1) if vb else None} "
        f"uniqueIds={n_id} paths={n_path}"
    )

# PNG dimensions via struct
import struct

print()
for name in pngs:
    path = os.path.join(root, name)
    with open(path, "rb") as f:
        sig = f.read(8)
        assert sig[:4] == b"\x89PNG"
        f.read(4)
        assert f.read(4) == b"IHDR"
        w, h = struct.unpack(">II", f.read(8))
    print(f"{name}: {w}x{h} px, {os.path.getsize(path)} bytes")
