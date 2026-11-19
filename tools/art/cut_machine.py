# Cuts the AI-painted coin machine (tools/art/out/washer_7.png) out of its painted room: keeps the machine's
# outline (the top panel is narrower than the body), paints over the made-up lettering on the top panel, shrinks it
# and writes out/machine.png plus out/machine.b64.txt (a data URL to paste into the game).
#   tools/art/.venv/Scripts/python.exe tools/art/cut_machine.py
import os, io, base64
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), 'out')
img = Image.open(os.path.join(OUT, 'washer_7.png')).convert('RGBA')
# the made-up lettering on the top panel -> plain panel colour
d = ImageDraw.Draw(img)
panel = img.getpixel((600, 60))
d.rounded_rectangle((252, 34, 438, 102), radius=10, fill=panel)
# the machine's outline: top panel (x 222..810, y 12..140), then the body (x 186..842, y 132..1012)
mask = Image.new('L', img.size, 0)
m = ImageDraw.Draw(mask)
m.rounded_rectangle((222, 12, 810, 150), radius=8, fill=255)
m.rounded_rectangle((186, 132, 842, 1012), radius=8, fill=255)
img.putalpha(mask)
img = img.crop((186, 12, 843, 1013))
H = 420  # pixels tall in the file (drawn smaller in the game, sharp on big screens)
img = img.resize((round(img.width * H / img.height), H), Image.LANCZOS)
img.save(os.path.join(OUT, 'machine.png'), optimize=True)
buf = io.BytesIO()
img.save(buf, 'WEBP', quality=88)
with open(os.path.join(OUT, 'machine.b64.txt'), 'w') as f:
    f.write('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
print('machine', img.size, round(len(buf.getvalue()) / 1024), 'KB')
# where things are, as fractions of the cut picture (for the game): the round window and the top panel
W0, H0 = 657, 1001
print('window centre', round((512 - 186) / W0, 3), round((565 - 12) / H0, 3), 'door radius', round(218 / H0, 3), 'glass radius', round(118 / H0, 3))
