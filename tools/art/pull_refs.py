# Reference pictures (not used in the game): how a person's arm and hand look while pulling a wheeled cart
# behind them, side view. Painted with Stable Diffusion XL to study the pose. Writes tools/art/out/pull_<seed>.png
#   tools/art/.venv/Scripts/python.exe tools/art/pull_refs.py
import os, torch
from diffusers import StableDiffusionXLPipeline

OUT = os.path.join(os.path.dirname(__file__), 'out')
pipe = StableDiffusionXLPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True
).to('cuda')
PROMPT = ('full body side view of a person in a dressing gown and pyjamas walking to the right and pulling a wheeled '
          'shopping trolley behind them with one hand, arm reaching back holding the handle, clear arm and hand '
          'anatomy, clean simple cartoon illustration, bold outlines, flat colors, plain light background')
NEG = 'photo, blurry, extra arms, extra hands, deformed hands, text, watermark, crowd'
for seed in [3, 11, 29, 58]:
    g = torch.Generator('cuda').manual_seed(seed)
    img = pipe(PROMPT, negative_prompt=NEG, width=1024, height=1024, num_inference_steps=30, guidance_scale=7.0,
               generator=g).images[0]
    img.save(os.path.join(OUT, f'pull_{seed}.png'))
    print('saved', seed, flush=True)
