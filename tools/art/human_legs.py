# Paints the sleeping human's legs (pyjamas + trainers) for the laundromat scene with Stable Diffusion XL
# (stabilityai/stable-diffusion-xl-base-1.0, CreativeML Open RAIL++-M licence: fine to use in a game).
# Fixed seeds, so the same pictures come out every time. Writes tools/art/out/human_<seed>.png
#   tools/announcer/.venv-qwen/Scripts/python.exe tools/art/human_legs.py
import os, torch
from diffusers import StableDiffusionXLPipeline

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
pipe = StableDiffusionXLPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True
).to('cuda')

PROMPT = ('cartoon illustration, side view, the lower half of a giant sleepy human sitting on a chair, '
          'only legs visible from the thighs down, legs facing left, knees bent, feet flat on the floor, '
          'baggy blue and white striped pyjama trousers, chunky white trainers with red laces, '
          'thick bold black outlines, flat bright colors, simple cel shading, cute comic style, '
          'isolated on a plain solid bright green background')
NEG = ('photo, realistic, 3d render, upper body, face, head, hands, torso, text, watermark, signature, '
       'extra legs, blurry, gradient background, shadow on background, frame')
for seed in [7, 21, 42, 77, 123, 2024]:
    g = torch.Generator('cuda').manual_seed(seed)
    img = pipe(PROMPT, negative_prompt=NEG, width=1024, height=1024, num_inference_steps=30,
               guidance_scale=7.0, generator=g).images[0]
    path = os.path.join(OUT, f'human_{seed}.png')
    img.save(path)
    print('saved', path, flush=True)
