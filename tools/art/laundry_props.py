# Paints the laundromat props for the story's opening (the washers, Dryer No. 7 and the plastic chair) with
# Stable Diffusion XL, in the same cartoon style as the sleeping human's legs. Fixed seeds: same pictures every time.
# Writes tools/art/out/<name>_<seed>.png
#   tools/art/.venv/Scripts/python.exe tools/art/laundry_props.py [name ...]
import os, sys, torch
from diffusers import StableDiffusionXLPipeline

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
STYLE = ('cartoon illustration, thick bold black outlines, flat bright colors, simple cel shading, cute comic style, '
         'game sprite, centered, isolated on a plain solid bright green background')
NEG = ('photo, realistic, 3d render, text, letters, logo, watermark, signature, people, blurry, gradient background, '
       'shadow on background, frame, room, wall, floor, multiple objects, cropped')
PROPS = {
    'washer': 'front view of a single front-loading coin laundry washing machine, white and lilac metal body, '
              'big round glass door window in the middle with colorful socks tumbling inside, little control panel '
              'with buttons on top, a coin slot',
    'dryer': 'front view of a single tall old industrial coin laundry tumble dryer, white metal body, a huge round '
             'empty dark glass door window in the middle, a control panel on top, a coin box at the bottom, slightly '
             'spooky',
    'chair': 'side view of a single cheap orange plastic chair with thin metal legs, facing left',
}
pipe = StableDiffusionXLPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True
).to('cuda')
for name in sys.argv[1:] or PROPS:
    for seed in [7, 21, 42, 77]:
        g = torch.Generator('cuda').manual_seed(seed)
        img = pipe(PROPS[name] + ', ' + STYLE, negative_prompt=NEG, width=1024, height=1024,
                   num_inference_steps=30, guidance_scale=7.0, generator=g).images[0]
        path = os.path.join(OUT, f'{name}_{seed}.png')
        img.save(path)
        print('saved', path, flush=True)
