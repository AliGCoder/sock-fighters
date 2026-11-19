# Repaints the game's own drawing of the sleeping human's legs (tools/art/out/legs_drawn.png, on green) with
# Stable Diffusion XL, keeping the same pose and size: nicer pyjama folds, knees and trainers. Fixed seeds.
#   tools/art/.venv/Scripts/python.exe tools/art/human_img2img.py [strength]
import os, sys, torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline

OUT = os.path.join(os.path.dirname(__file__), 'out')
strength = float(sys.argv[1]) if len(sys.argv) > 1 else 0.55
src = Image.open(os.path.join(OUT, 'legs_drawn.png')).convert('RGB')
w, h = 1024, round(1024 * src.height / src.width / 8) * 8
src = src.resize((w, h), Image.LANCZOS)
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True
).to('cuda')
PROMPT = ('cartoon illustration of a giant sleeping human\'s legs seen from the side, sitting on an orange plastic '
          'chair, knees bent, baggy soft blue and white striped pyjama trousers with fabric folds and creases at the '
          'knee, cosy tan sheepskin boot slippers with fluffy cream wool cuffs and big rounded toes, thick bold black outlines, flat bright colors, '
          'simple cel shading, polished mobile game art, plain solid bright green background')
NEG = ('photo, realistic, 3d render, text, watermark, room, furniture, floor, wall, head, hands, torso, blurry, '
       'extra legs, extra feet, gradient background')
for seed in [7, 21, 42, 77]:
    g = torch.Generator('cuda').manual_seed(seed)
    img = pipe(PROMPT, negative_prompt=NEG, image=src, strength=strength, num_inference_steps=40,
               guidance_scale=7.5, generator=g).images[0]
    path = os.path.join(OUT, f'legs_ai_{int(strength * 100)}_{seed}.png')
    img.save(path)
    print('saved', path, flush=True)
