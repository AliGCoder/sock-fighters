# Cuts the green background off a painted picture, crops it, shrinks it and writes it as a small PNG plus a
# base64 text file ready to paste into the game.
#   tools/art/.venv/Scripts/python.exe tools/art/cutout.py tools/art/out/human_42.png 300
import sys, os, base64, io
import numpy as np
from PIL import Image

src, height = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 300
img = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
# how green each pixel is (the background): fully green -> clear, a little green (the edge) -> half see-through
greenness = g - np.maximum(r, b)
alpha = np.clip(255 - (greenness - 30) * 6, 0, 255).astype(np.uint8)
# take the green spill off the edges
spill = (greenness > 0)[..., None]
fixed = np.where(spill, np.stack([r, np.maximum(r, b), b], -1), img).astype(np.uint8)
rgba = np.dstack([fixed, alpha])
ys, xs = np.where(alpha > 40)
rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
out = Image.fromarray(rgba, 'RGBA')
w = round(out.width * height / out.height)
out = out.resize((w, height), Image.LANCZOS)
base = os.path.splitext(src)[0] + '_cut'
out.save(base + '.png', optimize=True)
buf = io.BytesIO()
out.save(buf, 'PNG', optimize=True)
with open(base + '.b64.txt', 'w') as f:
    f.write('data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
print('saved', base + '.png', out.size, round(len(buf.getvalue()) / 1024), 'KB')
